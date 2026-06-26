import type { StateMachineTransitionHook, StateMachineTransitionTable } from "./state-machine";
import { StateMachine } from "./state-machine";

export type PluginRegistryState =
  | "discovered"
  | "installed"
  | "enabled"
  | "disabled"
  | "uninstalled";

export type PluginRegistryEvent =
  | "installRequested"
  | "enableRequested"
  | "disableRequested"
  | "uninstallRequested"
  | "manifestDiscovered";

export type PluginRegistryTransitionTable<TContext = undefined> = StateMachineTransitionTable<
  PluginRegistryState,
  PluginRegistryEvent,
  TContext
>;

export const initialPluginRegistryState: PluginRegistryState = "discovered";

export const pluginRegistryTransitions: PluginRegistryTransitionTable = {
  discovered: {
    installRequested: "installed",
  },
  installed: {
    enableRequested: "enabled",
    disableRequested: "disabled",
    uninstallRequested: "uninstalled",
  },
  enabled: {
    disableRequested: "disabled",
    uninstallRequested: "uninstalled",
  },
  disabled: {
    enableRequested: "enabled",
    uninstallRequested: "uninstalled",
  },
  uninstalled: {
    manifestDiscovered: "discovered",
  },
};

export function canTransitionPluginRegistryState(
  state: PluginRegistryState,
  event: PluginRegistryEvent,
): boolean {
  return new PluginRegistryLifecycleMachine(state).canDispatch(event);
}

export function transitionPluginRegistryState(
  state: PluginRegistryState,
  event: PluginRegistryEvent,
): PluginRegistryState {
  return new PluginRegistryLifecycleMachine(state).dispatch(event);
}

export interface PluginRegistryLifecycleMachineOptions<TContext = undefined> {
  initialState?: PluginRegistryState;
  transitions?: StateMachineTransitionTable<PluginRegistryState, PluginRegistryEvent, TContext>;
  onTransition?: StateMachineTransitionHook<PluginRegistryState, PluginRegistryEvent, TContext>;
}

export class PluginRegistryLifecycleMachine<TContext = undefined> extends StateMachine<
  PluginRegistryState,
  PluginRegistryEvent,
  TContext
> {
  constructor(options: PluginRegistryState | PluginRegistryLifecycleMachineOptions<TContext> = {}) {
    const normalizedOptions =
      typeof options === "string"
        ? {
            initialState: options,
          }
        : options;

    super({
      initialState: normalizedOptions.initialState ?? initialPluginRegistryState,
      transitions:
        normalizedOptions.transitions ??
        (pluginRegistryTransitions as StateMachineTransitionTable<
          PluginRegistryState,
          PluginRegistryEvent,
          TContext
        >),
      invalidTransitionMessage: "Invalid plugin registry transition",
      blockedTransitionMessage: "Blocked plugin registry transition",
      onTransition: normalizedOptions.onTransition,
    });
  }
}
