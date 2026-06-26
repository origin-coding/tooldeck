import type { StateMachineTransitionHook, StateMachineTransitionTable } from "./state-machine";
import { StateMachine } from "./state-machine";

export type PluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export type PluginRuntimeEvent =
  | "activationRequested"
  | "activated"
  | "activationFailed"
  | "deactivationRequested"
  | "deactivated"
  | "disposeRequested";

export type PluginRuntimeTransitionTable<TContext = undefined> = StateMachineTransitionTable<
  PluginRuntimeState,
  PluginRuntimeEvent,
  TContext
>;

export const initialPluginRuntimeState: PluginRuntimeState = "inactive";

export const pluginRuntimeTransitions: PluginRuntimeTransitionTable = {
  inactive: {
    activationRequested: "activating",
    disposeRequested: "disposed",
  },
  activating: {
    activated: "active",
    activationFailed: "failed",
  },
  active: {
    deactivationRequested: "deactivating",
    disposeRequested: "disposed",
  },
  deactivating: {
    deactivated: "inactive",
    disposeRequested: "disposed",
  },
  failed: {
    activationRequested: "activating",
    disposeRequested: "disposed",
  },
  disposed: {},
};

export function canTransitionPluginRuntimeState(
  state: PluginRuntimeState,
  event: PluginRuntimeEvent,
): boolean {
  return new PluginRuntimeLifecycleMachine(state).canDispatch(event);
}

export function transitionPluginRuntimeState(
  state: PluginRuntimeState,
  event: PluginRuntimeEvent,
): PluginRuntimeState {
  return new PluginRuntimeLifecycleMachine(state).dispatch(event);
}

export interface PluginRuntimeLifecycleMachineOptions<TContext = undefined> {
  initialState?: PluginRuntimeState;
  transitions?: StateMachineTransitionTable<PluginRuntimeState, PluginRuntimeEvent, TContext>;
  onTransition?: StateMachineTransitionHook<PluginRuntimeState, PluginRuntimeEvent, TContext>;
}

export class PluginRuntimeLifecycleMachine<TContext = undefined> extends StateMachine<
  PluginRuntimeState,
  PluginRuntimeEvent,
  TContext
> {
  constructor(options: PluginRuntimeState | PluginRuntimeLifecycleMachineOptions<TContext> = {}) {
    const normalizedOptions =
      typeof options === "string"
        ? {
            initialState: options,
          }
        : options;

    super({
      initialState: normalizedOptions.initialState ?? initialPluginRuntimeState,
      transitions:
        normalizedOptions.transitions ??
        (pluginRuntimeTransitions as StateMachineTransitionTable<
          PluginRuntimeState,
          PluginRuntimeEvent,
          TContext
        >),
      invalidTransitionMessage: "Invalid plugin runtime transition",
      blockedTransitionMessage: "Blocked plugin runtime transition",
      onTransition: normalizedOptions.onTransition,
    });
  }
}

export { PluginRuntimeLifecycleMachine as PluginLifecycleMachine };
