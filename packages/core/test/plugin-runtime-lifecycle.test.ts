import { describe, expect, it } from "vitest";

import {
  canTransitionPluginRuntimeState,
  PluginRuntimeLifecycleMachine,
  transitionPluginRuntimeState,
} from "../src";

describe("PluginRuntimeLifecycleMachine", () => {
  it("moves through the happy path activation lifecycle", () => {
    const machine = new PluginRuntimeLifecycleMachine();

    expect(machine.state).toBe("inactive");
    expect(machine.dispatch("activationRequested")).toBe("activating");
    expect(machine.dispatch("activated")).toBe("active");
    expect(machine.dispatch("deactivationRequested")).toBe("deactivating");
    expect(machine.dispatch("deactivated")).toBe("inactive");
  });

  it("moves to failed when activation fails and allows retry", () => {
    const machine = new PluginRuntimeLifecycleMachine();

    machine.dispatch("activationRequested");

    expect(machine.dispatch("activationFailed")).toBe("failed");
    expect(machine.dispatch("activationRequested")).toBe("activating");
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionPluginRuntimeState("inactive", "activated")).toBe(false);

    expect(() => transitionPluginRuntimeState("inactive", "activated")).toThrow(
      "Invalid plugin runtime transition: inactive -> activated",
    );
  });

  it("treats disposed as a terminal runtime instance state", () => {
    const machine = new PluginRuntimeLifecycleMachine();

    expect(machine.dispatch("disposeRequested")).toBe("disposed");
    expect(machine.canDispatch("activationRequested")).toBe(false);
  });
});
