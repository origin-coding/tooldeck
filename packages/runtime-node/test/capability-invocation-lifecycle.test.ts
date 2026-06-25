import { describe, expect, it } from "vitest";

import {
  CapabilityInvocationLifecycleMachine,
  canTransitionCapabilityInvocationState,
  transitionCapabilityInvocationState,
} from "../src";

describe("CapabilityInvocationLifecycleMachine", () => {
  it("moves through validation, execution, and success", () => {
    const machine = new CapabilityInvocationLifecycleMachine();

    expect(machine.state).toBe("pending");
    expect(machine.dispatch("validationStarted")).toBe("validating");
    expect(machine.dispatch("validationSucceeded")).toBe("ready");
    expect(machine.dispatch("executionStarted")).toBe("running");
    expect(machine.dispatch("executionSucceeded")).toBe("succeeded");
  });

  it("can fail during validation or execution", () => {
    const validationMachine = new CapabilityInvocationLifecycleMachine();

    validationMachine.dispatch("validationStarted");
    expect(validationMachine.dispatch("validationFailed")).toBe("failed");

    const executionMachine = new CapabilityInvocationLifecycleMachine();

    executionMachine.dispatch("validationStarted");
    executionMachine.dispatch("validationSucceeded");
    executionMachine.dispatch("executionStarted");
    expect(executionMachine.dispatch("executionFailed")).toBe("failed");
  });

  it("treats succeeded and failed as terminal invocation states", () => {
    expect(canTransitionCapabilityInvocationState("succeeded", "executionFailed")).toBe(false);
    expect(canTransitionCapabilityInvocationState("failed", "validationStarted")).toBe(false);

    expect(() => transitionCapabilityInvocationState("succeeded", "executionFailed")).toThrow(
      "Invalid capability invocation transition: succeeded -> executionFailed",
    );
  });

  it("requires execution to start before it can succeed", () => {
    const machine = new CapabilityInvocationLifecycleMachine();

    machine.dispatch("validationStarted");
    machine.dispatch("validationSucceeded");

    expect(machine.state).toBe("ready");
    expect(machine.canDispatch("executionSucceeded")).toBe(false);
    expect(() => machine.dispatch("executionSucceeded")).toThrow(
      "Invalid capability invocation transition: ready -> executionSucceeded",
    );
  });
});
