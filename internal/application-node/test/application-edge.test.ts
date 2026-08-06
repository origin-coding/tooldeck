import { RuntimeError } from "@tooldeck/runtime-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { runRuntimeEffect } from "@/application/edge";

describe("runtime Effect application edge", () => {
  it("maps typed RuntimeError failures without exposing an Effect wrapper", async () => {
    await expect(
      runRuntimeEffect(
        Effect.fail(
          new RuntimeError({
            code: "ERR_RUNTIME_HOST_UNAVAILABLE",
            message: "Runtime host is unavailable",
            details: { runtimeKind: "node" },
          }),
        ),
      ),
    ).rejects.toMatchObject({
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "runtime",
      code: "ERR_RUNTIME_HOST_UNAVAILABLE",
      message: "Runtime host is unavailable",
      details: { runtimeKind: "node" },
    });
  });

  it("normalizes defects to an application ERR_UNKNOWN without Cause or FiberFailure", async () => {
    const defect = new Error("runtime defect");

    await expect(runRuntimeEffect(Effect.die(defect))).rejects.toMatchObject({
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_UNKNOWN",
      message: "runtime defect",
      cause: defect,
    });
  });

  it("normalizes interruption to an application ERR_UNKNOWN", async () => {
    await expect(runRuntimeEffect(Effect.interrupt)).rejects.toMatchObject({
      _tag: "ApplicationError",
      name: "ApplicationError",
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Runtime operation was interrupted.",
    });
  });
});
