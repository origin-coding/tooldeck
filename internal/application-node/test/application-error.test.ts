import { RuntimeError } from "@tooldeck/runtime-node";
import { describe, expect, it } from "vitest";

import { combinePrimaryAndCleanupErrors } from "@/errors/application-error-composition";
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
    const error = combinePrimaryAndCleanupErrors(
      primaryError,
      [cleanupError],
      "Startup and cleanup failed.",
    );

    expect(error).toMatchObject({
      source: "runtime",
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "Plugin activation failed",
      details: {
        pluginId: "dev.example.plugin",
        cleanupFailure: {
          tag: "ApplicationError",
          source: "application",
          code: "ERR_UNKNOWN",
          message: "database close failed",
        },
      },
      cause: {
        message: "Startup and cleanup failed.",
        cause: primaryError,
        errors: [primaryError, cleanupError],
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
    const error = combinePrimaryAndCleanupErrors(
      primaryError,
      cleanupErrors,
      "Operation and cleanup failed.",
    );

    expect(error).toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Primary operation failed",
      details: {
        cleanupFailures: [
          {
            tag: "ApplicationError",
            source: "application",
            code: "ERR_UNKNOWN",
            message: "runtime dispose failed",
          },
          {
            tag: "ApplicationError",
            source: "application",
            code: "ERR_UNKNOWN",
            message: "database close failed",
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
});
