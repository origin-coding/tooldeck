import { Cause, Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { ApplicationFailure } from "@/application/effect";
import {
  ApplicationLifecycleCoordinator,
  type ApplicationLifecycleResources,
} from "@/application/lifecycle";
import { ApplicationError } from "@/errors/error";

describe("ApplicationLifecycleCoordinator", () => {
  it("owns start and dispose single-flight policy over narrow resources", async () => {
    const calls: string[] = [];
    const coordinator = new ApplicationLifecycleCoordinator(
      createLifecycleResources({
        acquire: () =>
          Effect.sync(() => {
            calls.push("acquire");
          }),
        dispose: () =>
          Effect.sync(() => {
            calls.push("dispose");
          }),
      }),
    );

    const firstStart = coordinator.start();
    const secondStart = coordinator.start();

    expect(secondStart).toBe(firstStart);
    await firstStart;

    const firstDispose = coordinator.dispose();
    const secondDispose = coordinator.dispose();

    expect(secondDispose).toBe(firstDispose);
    await firstDispose;
    expect(calls).toEqual(["acquire", "dispose"]);
    await expect(coordinator.start()).rejects.toMatchObject({
      source: "application",
      code: "ERR_APPLICATION_DISPOSED",
      message: "Tooldeck application is disposing or has already been disposed.",
    });
  });

  it("returns to created after rollback so a failed start can use a new retry promise", async () => {
    const calls: string[] = [];
    const startError = new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "forced start failure",
    });
    let attempts = 0;
    const coordinator = new ApplicationLifecycleCoordinator(
      createLifecycleResources({
        acquire: () =>
          Effect.suspend(() => {
            attempts += 1;
            calls.push(`acquire:${attempts}`);
            return attempts === 1 ? Effect.fail(startError) : Effect.void;
          }),
        rollbackFailedStart: (cause) =>
          Effect.sync(() => {
            calls.push("rollback");
          }).pipe(Effect.zipRight(Effect.failCause(cause))),
        dispose: () =>
          Effect.sync(() => {
            calls.push("dispose");
          }),
      }),
    );

    const failedStart = coordinator.start();
    expect(coordinator.start()).toBe(failedStart);
    await expect(failedStart).rejects.toBe(startError);

    const retryStart = coordinator.start();
    expect(retryStart).not.toBe(failedStart);
    expect(coordinator.start()).toBe(retryStart);
    await expect(retryStart).resolves.toBeUndefined();
    await coordinator.dispose();

    expect(calls).toEqual(["acquire:1", "rollback", "acquire:2", "dispose"]);
  });

  it("commits the terminal lifecycle state even when resource disposal fails", async () => {
    const disposeError = new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "forced dispose failure",
    });
    let disposeCalls = 0;
    const coordinator = new ApplicationLifecycleCoordinator(
      createLifecycleResources({
        dispose: () =>
          Effect.suspend(() => {
            disposeCalls += 1;
            return Effect.fail(disposeError);
          }),
      }),
    );

    await coordinator.start();
    const dispose = coordinator.dispose();

    await expect(dispose).rejects.toBe(disposeError);
    expect(coordinator.dispose()).toBe(dispose);
    expect(disposeCalls).toBe(1);
    await expect(coordinator.start()).rejects.toMatchObject({
      code: "ERR_APPLICATION_DISPOSED",
    });
  });
});

function createLifecycleResources(
  overrides: Partial<ApplicationLifecycleResources> = {},
): ApplicationLifecycleResources {
  return {
    acquire: overrides.acquire ?? (() => Effect.void),
    rollbackFailedStart:
      overrides.rollbackFailedStart ??
      ((cause: Cause.Cause<ApplicationFailure>) => Effect.failCause(cause)),
    dispose: overrides.dispose ?? (() => Effect.void),
  };
}
