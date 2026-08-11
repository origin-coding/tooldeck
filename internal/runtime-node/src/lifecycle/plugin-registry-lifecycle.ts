import { type StateEvent, type StateTransitionTable } from "@tooldeck/state-machine";
import { Effect } from "effect";

import type { RuntimeEffect } from "@/effects/runtime-effect";
import {
  makeRuntimeStateMachine,
  type RuntimeStateMachine,
} from "@/lifecycle/runtime-state-machine";

export type PluginRegistryState =
  | "discovered"
  | "installed"
  | "enabled"
  | "disabled"
  | "uninstalled";

export interface PluginRegistryEvents {
  readonly installRequested: void;
  readonly enableRequested: void;
  readonly disableRequested: void;
  readonly uninstallRequested: void;
  readonly manifestDiscovered: void;
}

export type PluginRegistryEvent = StateEvent<PluginRegistryEvents>;

export type PluginRegistryTransitionTable = StateTransitionTable<
  PluginRegistryState,
  PluginRegistryEvents
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
): Effect.Effect<boolean> {
  return Effect.flatMap(makePluginRegistryLifecycleMachine(state), (machine) =>
    machine.canDispatch(event),
  );
}

export function transitionPluginRegistryState(
  state: PluginRegistryState,
  event: PluginRegistryEvent,
): RuntimeEffect<PluginRegistryState> {
  return Effect.flatMap(makePluginRegistryLifecycleMachine(state), (machine) =>
    Effect.map(machine.dispatch(event), (transition) => transition.to),
  );
}

export type PluginRegistryLifecycleMachine = RuntimeStateMachine<
  PluginRegistryState,
  PluginRegistryEvents
>;

export function makePluginRegistryLifecycleMachine(
  initialState: PluginRegistryState = initialPluginRegistryState,
): Effect.Effect<PluginRegistryLifecycleMachine> {
  return makeRuntimeStateMachine({
    initialState,
    transitions: pluginRegistryTransitions,
    messages: {
      invalidTransition: "Invalid plugin registry transition",
      blockedTransition: "Blocked plugin registry transition",
    },
  });
}
