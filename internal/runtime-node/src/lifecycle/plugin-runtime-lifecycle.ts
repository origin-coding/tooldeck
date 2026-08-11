import { type StateEvent, type StateTransitionTable } from "@tooldeck/state-machine";
import { Effect } from "effect";

import type { RuntimeEffect } from "@/effects/runtime-effect";
import {
  makeRuntimeStateMachine,
  type RuntimeStateMachine,
} from "@/lifecycle/runtime-state-machine";

export type PluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export interface PluginRuntimeEvents {
  readonly activationRequested: void;
  readonly activated: void;
  readonly activationFailed: void;
  readonly deactivationRequested: void;
  readonly deactivated: void;
  readonly disposeRequested: void;
}

export type PluginRuntimeEvent = StateEvent<PluginRuntimeEvents>;

export type PluginRuntimeTransitionTable = StateTransitionTable<
  PluginRuntimeState,
  PluginRuntimeEvents
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
): Effect.Effect<boolean> {
  return Effect.flatMap(makePluginRuntimeLifecycleMachine(state), (machine) =>
    machine.canDispatch(event),
  );
}

export function transitionPluginRuntimeState(
  state: PluginRuntimeState,
  event: PluginRuntimeEvent,
): RuntimeEffect<PluginRuntimeState> {
  return Effect.flatMap(makePluginRuntimeLifecycleMachine(state), (machine) =>
    Effect.map(machine.dispatch(event), (transition) => transition.to),
  );
}

export type PluginRuntimeLifecycleMachine = RuntimeStateMachine<
  PluginRuntimeState,
  PluginRuntimeEvents
>;

export function makePluginRuntimeLifecycleMachine(
  initialState: PluginRuntimeState = initialPluginRuntimeState,
): Effect.Effect<PluginRuntimeLifecycleMachine> {
  return makeRuntimeStateMachine({
    initialState,
    transitions: pluginRuntimeTransitions,
    messages: {
      invalidTransition: "Invalid plugin runtime transition",
      blockedTransition: "Blocked plugin runtime transition",
    },
  });
}
