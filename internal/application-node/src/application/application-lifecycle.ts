import { type StateEvent, type StateTransitionTable } from "@tooldeck/state-machine";
import { Effect } from "effect";

import {
  type ApplicationStateMachine,
  makeApplicationStateMachine,
} from "@/application/application-state-machine";

export type ApplicationLifecycleState =
  | "created"
  | "starting"
  | "started"
  | "disposing"
  | "disposed";

export interface ApplicationLifecycleEvents {
  readonly startRequested: void;
  readonly startSucceeded: void;
  readonly startRolledBack: void;
  readonly disposeRequested: void;
  readonly disposeCompleted: void;
}

export type ApplicationLifecycleEvent = StateEvent<ApplicationLifecycleEvents>;

export type ApplicationLifecycleTransitionTable = StateTransitionTable<
  ApplicationLifecycleState,
  ApplicationLifecycleEvents
>;

export const initialApplicationLifecycleState: ApplicationLifecycleState = "created";

export const applicationLifecycleTransitions: ApplicationLifecycleTransitionTable = {
  created: {
    startRequested: "starting",
    disposeRequested: "disposing",
  },
  starting: {
    startSucceeded: "started",
    startRolledBack: "created",
  },
  started: {
    disposeRequested: "disposing",
  },
  disposing: {
    disposeCompleted: "disposed",
  },
  disposed: {},
};

export type ApplicationLifecycleMachine = ApplicationStateMachine<
  ApplicationLifecycleState,
  ApplicationLifecycleEvents
>;

export function makeApplicationLifecycleMachine(): Effect.Effect<ApplicationLifecycleMachine> {
  return makeApplicationStateMachine({
    initialState: initialApplicationLifecycleState,
    transitions: applicationLifecycleTransitions,
    messages: {
      invalidTransition: "Invalid application lifecycle transition",
      blockedTransition: "Blocked application lifecycle transition",
    },
  });
}
