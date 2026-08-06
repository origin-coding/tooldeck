import { RuntimeError } from "@tooldeck/runtime-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { runApplicationEffect, runRuntimeEffect } from "@/application/edge";
import { ApplicationError } from "@/errors/application-error";

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

describe("application Effect edge", () => {
  it("preserves typed ApplicationError failures", async () => {
    const error = new ApplicationError({
      source: "application",
      code: "ERR_APPLICATION_NOT_STARTED",
      message: "Application is not started",
    });

    await expect(runApplicationEffect(Effect.fail(error))).rejects.toBe(error);
  });

  it("normalizes application Scope defects without exposing FiberFailure", async () => {
    const defect = new Error("application scope defect");

    await expect(runApplicationEffect(Effect.die(defect))).rejects.toMatchObject({
      _tag: "ApplicationError",
      source: "application",
      code: "ERR_UNKNOWN",
      message: "application scope defect",
      cause: defect,
    });
  });

  it("normalizes application Scope interruption", async () => {
    await expect(runApplicationEffect(Effect.interrupt)).rejects.toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation was interrupted.",
    });
  });
});
