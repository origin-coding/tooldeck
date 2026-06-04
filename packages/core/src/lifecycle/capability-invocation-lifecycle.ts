import type { StateMachineTransitionHook, StateMachineTransitionTable } from "./state-machine";
import { StateMachine } from "./state-machine";

export type CapabilityInvocationState =
  | "pending"
  | "validating"
  | "ready"
  | "running"
  | "succeeded"
  | "failed";

export type CapabilityInvocationEvent =
  | "validationStarted"
  | "validationSucceeded"
  | "validationFailed"
  | "executionStarted"
  | "executionSucceeded"
  | "executionFailed";

export type CapabilityInvocationTransitionTable<TContext = undefined> = StateMachineTransitionTable<
  CapabilityInvocationState,
  CapabilityInvocationEvent,
  TContext
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
): boolean {
  return new CapabilityInvocationLifecycleMachine(state).canDispatch(event);
}

export function transitionCapabilityInvocationState(
  state: CapabilityInvocationState,
  event: CapabilityInvocationEvent,
): CapabilityInvocationState {
  return new CapabilityInvocationLifecycleMachine(state).dispatch(event);
}

export interface CapabilityInvocationLifecycleMachineOptions<TContext = undefined> {
  initialState?: CapabilityInvocationState;
  transitions?: StateMachineTransitionTable<
    CapabilityInvocationState,
    CapabilityInvocationEvent,
    TContext
  >;
  onTransition?: StateMachineTransitionHook<
    CapabilityInvocationState,
    CapabilityInvocationEvent,
    TContext
  >;
}

export class CapabilityInvocationLifecycleMachine<TContext = undefined> extends StateMachine<
  CapabilityInvocationState,
  CapabilityInvocationEvent,
  TContext
> {
  constructor(
    options: CapabilityInvocationState | CapabilityInvocationLifecycleMachineOptions<TContext> = {},
  ) {
    const normalizedOptions =
      typeof options === "string"
        ? {
            initialState: options,
          }
        : options;

    super({
      initialState: normalizedOptions.initialState ?? initialCapabilityInvocationState,
      transitions:
        normalizedOptions.transitions ??
        (capabilityInvocationTransitions as StateMachineTransitionTable<
          CapabilityInvocationState,
          CapabilityInvocationEvent,
          TContext
        >),
      invalidTransitionMessage: "Invalid capability invocation transition",
      blockedTransitionMessage: "Blocked capability invocation transition",
      onTransition: normalizedOptions.onTransition,
    });
  }
}
