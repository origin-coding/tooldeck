import { describe, expect, it } from "vitest";

import {
  canTransitionPluginRegistryState,
  PluginRegistryLifecycleMachine,
  transitionPluginRegistryState,
} from "../src";

describe("PluginRegistryLifecycleMachine", () => {
  it("moves through install, enable, disable, and uninstall", () => {
    const machine = new PluginRegistryLifecycleMachine();

    expect(machine.state).toBe("discovered");
    expect(machine.dispatch("installRequested")).toBe("installed");
    expect(machine.dispatch("enableRequested")).toBe("enabled");
    expect(machine.dispatch("disableRequested")).toBe("disabled");
    expect(machine.dispatch("uninstallRequested")).toBe("uninstalled");
  });

  it("allows rediscovery after uninstall when a manifest is found again", () => {
    const machine = new PluginRegistryLifecycleMachine("uninstalled");

    expect(machine.dispatch("manifestDiscovered")).toBe("discovered");
  });

  it("rejects runtime events from the registry lifecycle", () => {
    expect(canTransitionPluginRegistryState("discovered", "enableRequested")).toBe(false);

    expect(() => transitionPluginRegistryState("discovered", "enableRequested")).toThrow(
      "Invalid plugin registry transition: discovered -> enableRequested",
    );
  });
});
