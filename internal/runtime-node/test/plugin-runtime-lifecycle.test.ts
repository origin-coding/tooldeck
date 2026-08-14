import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effect";
import {
  canTransitionPluginRuntimeState,
  makePluginRuntimeLifecycleMachine,
  transitionPluginRuntimeState,
} from "@/index";

describe("PluginRuntimeLifecycleMachine", () => {
  it("moves through the happy path activation lifecycle", async () => {
    const machine = await runRuntimeEffectPromise(makePluginRuntimeLifecycleMachine());

    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("inactive");
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "activationRequested" })),
    ).resolves.toMatchObject({ from: "inactive", to: "activating" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "activated" })),
    ).resolves.toMatchObject({ from: "activating", to: "active" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "deactivationRequested" })),
    ).resolves.toMatchObject({ from: "active", to: "deactivating" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "deactivated" })),
    ).resolves.toMatchObject({ from: "deactivating", to: "inactive" });
  });

  it("moves to failed when activation fails and allows retry", async () => {
    const machine = await runRuntimeEffectPromise(makePluginRuntimeLifecycleMachine());

    await runRuntimeEffectPromise(machine.dispatch({ type: "activationRequested" }));
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "activationFailed" })),
    ).resolves.toMatchObject({ to: "failed" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "activationRequested" })),
    ).resolves.toMatchObject({ to: "activating" });
  });

  it("maps invalid transitions to the existing RuntimeError shape", async () => {
    await expect(
      runRuntimeEffectPromise(canTransitionPluginRuntimeState("inactive", { type: "activated" })),
    ).resolves.toBe(false);

    await expect(
      runRuntimeEffectPromise(transitionPluginRuntimeState("inactive", { type: "activated" })),
    ).rejects.toMatchObject({
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid plugin runtime transition: inactive -> activated",
      details: {
        state: "inactive",
        event: "activated",
      },
    });
  });

  it("treats disposed as a terminal runtime instance state", async () => {
    const machine = await runRuntimeEffectPromise(makePluginRuntimeLifecycleMachine());

    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "disposeRequested" })),
    ).resolves.toMatchObject({ to: "disposed" });
    await expect(
      runRuntimeEffectPromise(machine.canDispatch({ type: "activationRequested" })),
    ).resolves.toBe(false);
  });
});
