import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise } from "@/effects/runtime-effect";
import {
  canTransitionPluginRegistryState,
  makePluginRegistryLifecycleMachine,
  transitionPluginRegistryState,
} from "@/index";

describe("PluginRegistryLifecycleMachine", () => {
  it("moves through install, enable, disable, and uninstall", async () => {
    const machine = await runRuntimeEffectPromise(makePluginRegistryLifecycleMachine());

    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("discovered");
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "installRequested" })),
    ).resolves.toMatchObject({ to: "installed" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "enableRequested" })),
    ).resolves.toMatchObject({ to: "enabled" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "disableRequested" })),
    ).resolves.toMatchObject({ to: "disabled" });
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "uninstallRequested" })),
    ).resolves.toMatchObject({ to: "uninstalled" });
  });

  it("allows rediscovery after uninstall when a manifest is found again", async () => {
    const machine = await runRuntimeEffectPromise(
      makePluginRegistryLifecycleMachine("uninstalled"),
    );

    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "manifestDiscovered" })),
    ).resolves.toMatchObject({ to: "discovered" });
  });

  it("rejects runtime events from the registry lifecycle", async () => {
    await expect(
      runRuntimeEffectPromise(
        canTransitionPluginRegistryState("discovered", { type: "enableRequested" }),
      ),
    ).resolves.toBe(false);

    await expect(
      runRuntimeEffectPromise(
        transitionPluginRegistryState("discovered", { type: "enableRequested" }),
      ),
    ).rejects.toMatchObject({
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid plugin registry transition: discovered -> enableRequested",
      details: {
        state: "discovered",
        event: "enableRequested",
      },
    });
  });
});
