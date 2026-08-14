import { type StateEvent, type StateTransitionTable } from "@tooldeck/state-machine";
import { Effect } from "effect";

import type { RuntimeEffect } from "@/effect";
import { makeRuntimeStateMachine, type RuntimeStateMachine } from "@/lifecycle/state-machine";

export type CapabilityInvocationState =
  | "pending"
  | "validating"
  | "ready"
  | "running"
  | "succeeded"
  | "failed";

export interface CapabilityInvocationEvents {
  readonly validationStarted: void;
  readonly validationSucceeded: void;
  readonly validationFailed: void;
  readonly executionStarted: void;
  readonly executionSucceeded: void;
  readonly executionFailed: void;
}

export type CapabilityInvocationEvent = StateEvent<CapabilityInvocationEvents>;

export type CapabilityInvocationTransitionTable = StateTransitionTable<
  CapabilityInvocationState,
  CapabilityInvocationEvents
>;

export const initialCapabilityInvocationState: CapabilityInvocationState = "pending";

export const capabilityInvocationTransitions: CapabilityInvocationTransitionTable = {
  pending: {
    validationStarted: "validating",
  },
  validating: {
    validationSucceeded: "ready",
    validationFailed: "failed",
  },
  ready: {
    executionStarted: "running",
  },
  running: {
    executionSucceeded: "succeeded",
    executionFailed: "failed",
  },
  succeeded: {},
  failed: {},
};

export function canTransitionCapabilityInvocationState(
  state: CapabilityInvocationState,
  event: CapabilityInvocationEvent,
): Effect.Effect<boolean> {
  return Effect.flatMap(makeCapabilityInvocationLifecycleMachine(state), (machine) =>
    machine.canDispatch(event),
  );
}

export function transitionCapabilityInvocationState(
  state: CapabilityInvocationState,
  event: CapabilityInvocationEvent,
): RuntimeEffect<CapabilityInvocationState> {
  return Effect.flatMap(makeCapabilityInvocationLifecycleMachine(state), (machine) =>
    Effect.map(machine.dispatch(event), (transition) => transition.to),
  );
}

export type CapabilityInvocationLifecycleMachine = RuntimeStateMachine<
  CapabilityInvocationState,
  CapabilityInvocationEvents
>;

export function makeCapabilityInvocationLifecycleMachine(
  initialState: CapabilityInvocationState = initialCapabilityInvocationState,
): Effect.Effect<CapabilityInvocationLifecycleMachine> {
  return makeRuntimeStateMachine({
    initialState,
    transitions: capabilityInvocationTransitions,
    messages: {
      invalidTransition: "Invalid capability invocation transition",
      blockedTransition: "Blocked capability invocation transition",
    },
  });
}
