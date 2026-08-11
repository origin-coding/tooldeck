import {
  captureRuntimeCleanupFailure,
  createRuntimeCleanupError,
  RuntimeError,
} from "@tooldeck/runtime-node";
import { describe, expect, it } from "vitest";

import {
  captureApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  type ApplicationCleanupFailureDiagnostic,
} from "@/errors/application-cleanup";
import {
  ApplicationError,
  fromRuntimeError,
  isApplicationError,
  toApplicationError,
  toApplicationErrorTransport,
} from "@/index";

describe("ApplicationError", () => {
  it("preserves its source, code, details, and cause", () => {
    const cause = new Error("database failure");
    const error = new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application startup failed",
      cause,
      details: {
        operation: "start",
      },
    });

    expect(error).toMatchObject({
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application startup failed",
      cause,
      details: {
        operation: "start",
      },
    });
  });

  it("recognizes an application error by stable shape and optional code", () => {
    const foreignApplicationError = {
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid configuration",
      details: {
        field: "databasePath",
      },
    };

    expect(foreignApplicationError).not.toBeInstanceOf(ApplicationError);
    expect(isApplicationError(foreignApplicationError)).toBe(true);
    expect(isApplicationError(foreignApplicationError, "ERR_INVALID_ARGUMENT")).toBe(true);
    expect(isApplicationError(foreignApplicationError, "ERR_NOT_FOUND")).toBe(false);
    expect(toApplicationError(foreignApplicationError)).toBe(foreignApplicationError);
  });

  it("converts runtime errors without exposing their type through the function signature", () => {
    const runtimeError = new RuntimeError({
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      message: "No runtime host is registered",
      details: {
        pluginId: "dev.example.plugin",
        runtimeKind: "node",
      },
    });
    const applicationError = fromRuntimeError(runtimeError);

    expect(applicationError).toMatchObject({
      _tag: "ApplicationError",
      source: "runtime",
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      message: "No runtime host is registered",
      cause: runtimeError,
      details: {
        pluginId: "dev.example.plugin",
        runtimeKind: "node",
      },
    });
  });

  it("normalizes regular and non-Error application failures", () => {
    const cause = new Error("unexpected failure");

    expect(toApplicationError(cause)).toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "unexpected failure",
      cause,
    });
    expect(toApplicationError("string failure")).toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "string failure",
      details: {
        thrown: "string failure",
      },
    });
  });

  it("serializes only stable JSON-safe transport fields", () => {
    const cause = new Error("internal failure");
    const error = new ApplicationError({
      source: "application",
      code: "ERR_COMMAND_FAILED",
      message: "Command execution failed",
      cause,
      details: {
        commandId: "json.format",
      },
    });

    expect(toApplicationErrorTransport(error)).toEqual({
      tag: "ApplicationError",
      source: "application",
      code: "ERR_COMMAND_FAILED",
      message: "Command execution failed",
      details: {
        commandId: "json.format",
      },
    });
  });

  it("preserves a primary failure when cleanup also fails", () => {
    const primaryError = new RuntimeError({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Plugin activation failed",
      details: {
        pluginId: "dev.example.plugin",
      },
    });
    const cleanupError = new Error("database close failed");
    const error = combinePrimaryAndCleanupFailures(
      primaryError,
      [
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "database.close",
          context: {},
          error: cleanupError,
        }),
      ],
      "Startup and cleanup failed.",
    );

    expect(error).toMatchObject({
      source: "runtime",
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Plugin activation failed",
      details: {
        pluginId: "dev.example.plugin",
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "database.close",
            context: {},
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "database close failed",
            },
          },
        ],
      },
      cause: {
        message: "Startup and cleanup failed.",
        cause: expect.objectContaining({ source: "runtime", cause: primaryError }),
        errors: [expect.objectContaining({ source: "runtime", cause: primaryError }), cleanupError],
      },
    });
  });

  it("records every secondary failure when multiple cleanup steps fail", () => {
    const primaryError = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Primary operation failed",
    });
    const cleanupErrors = [new Error("runtime dispose failed"), new Error("database close failed")];
    const error = combinePrimaryAndCleanupFailures(
      primaryError,
      [
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "runtime.dispose",
          context: {},
          error: cleanupErrors[0],
        }),
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "database.close",
          context: {},
          error: cleanupErrors[1],
        }),
      ],
      "Operation and cleanup failed.",
    );

    expect(error).toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Primary operation failed",
      details: {
        cleanupFailures: [
          {
            phase: "cleanup",
            step: "runtime.dispose",
            context: {},
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "runtime dispose failed",
            },
          },
          {
            phase: "cleanup",
            step: "database.close",
            context: {},
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "database close failed",
            },
          },
        ],
      },
      cause: {
        message: "Operation and cleanup failed.",
        cause: primaryError,
        errors: [primaryError, ...cleanupErrors],
      },
    });
  });

  it("maps every Runtime cleanup variant without flattening nested ownership", () => {
    const subscriptionFailure = captureRuntimeCleanupFailure({
      step: "subscription.dispose",
      context: { pluginId: "dev.example.plugin" },
      error: new Error("subscription failed"),
    });
    const subscriptionsError = createRuntimeCleanupError("Subscriptions failed", [
      subscriptionFailure,
    ]);
    const applicationError = fromRuntimeError(
      createRuntimeCleanupError("Runtime cleanup failed", [
        captureRuntimeCleanupFailure({
          step: "subscription.dispose",
          context: { pluginId: "dev.example.plugin" },
          error: new Error("single subscription failed"),
        }),
        captureRuntimeCleanupFailure({
          step: "subscriptions.dispose",
          context: { pluginId: "dev.example.plugin" },
          error: subscriptionsError,
        }),
        captureRuntimeCleanupFailure({
          step: "plugin.deactivate",
          context: { pluginId: "dev.example.plugin" },
          error: new Error("deactivate failed"),
        }),
        captureRuntimeCleanupFailure({
          step: "plugin.dispose",
          context: { pluginId: "dev.example.plugin" },
          error: subscriptionsError,
        }),
        captureRuntimeCleanupFailure({
          step: "host.dispose",
          context: { runtimeKind: "node" },
          error: new Error("host failed"),
        }),
      ]),
    );

    expect(
      applicationError.details?.cleanupFailures?.map((failure) => ({
        step: failure.step,
        context: failure.context,
      })),
    ).toEqual([
      { step: "subscription.dispose", context: { pluginId: "dev.example.plugin" } },
      { step: "subscriptions.dispose", context: { pluginId: "dev.example.plugin" } },
      { step: "plugin.deactivate", context: { pluginId: "dev.example.plugin" } },
      { step: "plugin.dispose", context: { pluginId: "dev.example.plugin" } },
      { step: "host.dispose", context: { runtimeKind: "node" } },
    ]);
    expect(applicationError.details?.cleanupFailures?.[3]).toMatchObject({
      step: "plugin.dispose",
      error: {
        source: "runtime",
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: "Subscriptions failed",
        details: {
          cleanupFailures: [
            {
              phase: "cleanup",
              step: "subscription.dispose",
              context: { pluginId: "dev.example.plugin" },
              error: {
                source: "runtime",
                code: "ERR_UNKNOWN",
                message: "subscription failed",
              },
            },
          ],
        },
      },
    });
  });

  it("appends existing canonical diagnostics before newly observed failures", () => {
    const existing = captureApplicationCleanupFailure({
      phase: "cleanup",
      step: "runtime.dispose",
      context: {},
      error: new Error("runtime failed"),
    }).diagnostic;
    const primary = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "primary failed",
      details: { cleanupFailures: [existing] },
    });

    const combined = combinePrimaryAndCleanupFailures(
      primary,
      [
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "database.close",
          context: {},
          error: new Error("database failed"),
        }),
      ],
      "combined",
    );

    expect(combined.details?.cleanupFailures?.map((failure) => failure.step)).toEqual([
      "runtime.dispose",
      "database.close",
    ]);
  });

  it("constructs every registered Application cleanup and rollback step", () => {
    const failures = [
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "application.dispose",
        context: {},
        error: new Error("application dispose failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "applicationResources.dispose",
        context: {},
        error: new Error("application resource dispose failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "runtime.dispose",
        context: {},
        error: new Error("runtime dispose failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "database.close",
        context: {},
        error: new Error("database close failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "databaseTransaction.rollback",
        context: {},
        error: new Error("database transaction rollback failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "pluginStaging.remove",
        context: { stagingEntry: "install-example", pluginId: "dev.example.plugin" },
        error: new Error("staging remove failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "pluginInstall.delete",
        context: { pluginId: "dev.example.plugin" },
        error: new Error("install delete failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "pluginDirectory.remove",
        context: { pluginId: "dev.example.plugin" },
        error: new Error("directory remove failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "pluginCatalog.restore",
        context: { pluginId: "dev.example.plugin" },
        error: new Error("catalog restore failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "pluginDirectory.restore",
        context: { pluginId: "dev.example.plugin", stagingEntry: "uninstall-example" },
        error: new Error("directory restore failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "rollback",
        step: "pluginInstall.restore",
        context: { pluginId: "dev.example.plugin" },
        error: new Error("install restore failed"),
      }),
      captureApplicationCleanupFailure({
        phase: "cleanup",
        step: "pluginQuarantine.remove",
        context: { pluginId: "dev.example.plugin", stagingEntry: "uninstall-example" },
        error: new Error("quarantine remove failed"),
      }),
    ];

    expect(
      failures.map((failure) => `${failure.diagnostic.phase}:${failure.diagnostic.step}`),
    ).toEqual([
      "cleanup:application.dispose",
      "cleanup:applicationResources.dispose",
      "cleanup:runtime.dispose",
      "cleanup:database.close",
      "rollback:databaseTransaction.rollback",
      "cleanup:pluginStaging.remove",
      "rollback:pluginInstall.delete",
      "rollback:pluginDirectory.remove",
      "rollback:pluginCatalog.restore",
      "rollback:pluginDirectory.restore",
      "rollback:pluginInstall.restore",
      "cleanup:pluginQuarantine.remove",
    ]);
  });

  void (() => {
    captureApplicationCleanupFailure({
      // @ts-expect-error pluginInstall.delete is a rollback step.
      phase: "cleanup",
      step: "pluginInstall.delete",
      context: { pluginId: "dev.example.plugin" },
      error: new Error("invalid phase"),
    });
    captureApplicationCleanupFailure({
      phase: "rollback",
      step: "pluginDirectory.restore",
      // @ts-expect-error pluginDirectory.restore requires stagingEntry.
      context: { pluginId: "dev.example.plugin" },
      error: new Error("invalid context"),
    });
    captureApplicationCleanupFailure({
      phase: "cleanup",
      step: "database.close",
      context: {
        // @ts-expect-error database.close does not accept context identifiers.
        pluginId: "dev.example.plugin",
      },
      error: new Error("unexpected context field"),
    });

    const diagnostic: ApplicationCleanupFailureDiagnostic = {
      phase: "cleanup",
      step: "database.close",
      context: {},
      error: {
        source: "application",
        code: "ERR_UNKNOWN",
        message: "database close failed",
        // @ts-expect-error raw stack data is not part of the closed error snapshot.
        stack: "internal stack",
      },
    };

    void diagnostic;
  });
});
