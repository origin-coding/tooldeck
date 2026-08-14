import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effect";
import {
  canTransitionCapabilityInvocationState,
  makeCapabilityInvocationLifecycleMachine,
  transitionCapabilityInvocationState,
} from "@/index";

describe("CapabilityInvocationLifecycleMachine", () => {
  it("moves through validation, execution, and success", async () => {
    const machine = await runRuntimeEffectPromise(makeCapabilityInvocationLifecycleMachine());

    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("pending");
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "validationStarted" })),
    ).resolves.toMatchObject({ to: "validating" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "validationSucceeded" })),
    ).resolves.toMatchObject({ to: "ready" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "executionStarted" })),
    ).resolves.toMatchObject({ to: "running" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "executionSucceeded" })),
    ).resolves.toMatchObject({ to: "succeeded" });
  });

  it("can fail during validation or execution", async () => {
    const validationMachine = await runRuntimeEffectPromise(
      makeCapabilityInvocationLifecycleMachine(),
    );

    await runRuntimeEffectPromise(validationMachine.dispatch({ type: "validationStarted" }));
    await expect(
      runRuntimeEffectPromise(validationMachine.dispatch({ type: "validationFailed" })),
    ).resolves.toMatchObject({ to: "failed" });

    const executionMachine = await runRuntimeEffectPromise(
      makeCapabilityInvocationLifecycleMachine(),
    );

    await runRuntimeEffectPromise(executionMachine.dispatch({ type: "validationStarted" }));
    await runRuntimeEffectPromise(executionMachine.dispatch({ type: "validationSucceeded" }));
    await runRuntimeEffectPromise(executionMachine.dispatch({ type: "executionStarted" }));
    await expect(
      runRuntimeEffectPromise(executionMachine.dispatch({ type: "executionFailed" })),
    ).resolves.toMatchObject({ to: "failed" });
  });

  it("treats succeeded and failed as terminal invocation states", async () => {
    await expect(
      runRuntimeEffectPromise(
        canTransitionCapabilityInvocationState("succeeded", { type: "executionFailed" }),
      ),
    ).resolves.toBe(false);
    await expect(
      runRuntimeEffectPromise(
        canTransitionCapabilityInvocationState("failed", { type: "validationStarted" }),
      ),
    ).resolves.toBe(false);

    await expect(
      runRuntimeEffectPromise(
        transitionCapabilityInvocationState("succeeded", { type: "executionFailed" }),
      ),
    ).rejects.toMatchObject({
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid capability invocation transition: succeeded -> executionFailed",
      details: {
        state: "succeeded",
        event: "executionFailed",
      },
    });
  });

  it("requires execution to start before it can succeed", async () => {
    const machine = await runRuntimeEffectPromise(makeCapabilityInvocationLifecycleMachine());

    await runRuntimeEffectPromise(machine.dispatch({ type: "validationStarted" }));
    await runRuntimeEffectPromise(machine.dispatch({ type: "validationSucceeded" }));

    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("ready");
    await expect(
      runRuntimeEffectPromise(machine.canDispatch({ type: "executionSucceeded" })),
    ).resolves.toBe(false);
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "executionSucceeded" })),
    ).rejects.toMatchObject({
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid capability invocation transition: ready -> executionSucceeded",
    });
  });
});
