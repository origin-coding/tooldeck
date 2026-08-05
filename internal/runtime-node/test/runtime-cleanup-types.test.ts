import { describe, expect, it } from "vitest";

import { captureRuntimeCleanupFailure, type RuntimeCleanupFailureDiagnostic } from "@/index";

describe("Runtime cleanup diagnostic types", () => {
  it("constructs only registered cleanup step and context combinations", () => {
    const failure = captureRuntimeCleanupFailure({
      step: "host.dispose",
      context: { runtimeKind: "node" },
      error: new Error("host failed"),
    });

    expect(failure.diagnostic).toMatchObject({
      phase: "cleanup",
      step: "host.dispose",
      context: { runtimeKind: "node" },
    });
  });

  void (() => {
    captureRuntimeCleanupFailure({
      step: "host.dispose",
      // @ts-expect-error host.dispose requires runtimeKind, not pluginId.
      context: { pluginId: "dev.example.plugin" },
      error: new Error("invalid context"),
    });
    captureRuntimeCleanupFailure({
      step: "host.dispose",
      context: {
        runtimeKind: "node",
        // @ts-expect-error host.dispose accepts only the registered runtimeKind context.
        pluginId: "dev.example.plugin",
      },
      error: new Error("unexpected context field"),
    });
    captureRuntimeCleanupFailure({
      // @ts-expect-error plugin.activate is a primary operation, not a cleanup step.
      step: "plugin.activate",
      context: { pluginId: "dev.example.plugin" },
      error: new Error("invalid step"),
    });

    const diagnostic: RuntimeCleanupFailureDiagnostic = {
      phase: "cleanup",
      step: "host.dispose",
      context: { runtimeKind: "node" },
      error: {
        source: "runtime",
        code: "ERR_UNKNOWN",
        message: "host failed",
        // @ts-expect-error raw stack data is not part of the closed error snapshot.
        stack: "internal stack",
      },
    };

    void diagnostic;
  });
});
