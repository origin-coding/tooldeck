import {
  makeStateMachine,
  type StateEventName,
  type StateEventOf,
  type StateTransitionError,
  type StateTransitionRecord,
  type StateTransitionTable,
} from "@tooldeck/state-machine";
import { Effect } from "effect";

import type { RuntimeEffect } from "@/effects/runtime-effect";
import { RuntimeError } from "@/errors/runtime-error";

export interface RuntimeStateMachineMessages {
  readonly invalidTransition: string;
  readonly blockedTransition: string;
}

export interface RuntimeStateMachineOptions<TState extends string, TEvents extends object> {
  readonly initialState: TState;
  readonly transitions: StateTransitionTable<TState, TEvents>;
  readonly messages: RuntimeStateMachineMessages;
}

export interface RuntimeStateMachine<TState extends string, TEvents extends object> {
  readonly state: Effect.Effect<TState>;
  readonly canDispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => Effect.Effect<boolean>;
  readonly dispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => RuntimeEffect<StateTransitionRecord<TState, StateEventOf<TEvents, TEvent>>>;
}

export function makeRuntimeStateMachine<TState extends string, TEvents extends object>(
  options: RuntimeStateMachineOptions<TState, TEvents>,
): Effect.Effect<RuntimeStateMachine<TState, TEvents>> {
  return Effect.map(
    makeStateMachine<TState, TEvents>({
      initialState: options.initialState,
      transitions: options.transitions,
    }),
    (machine) => {
      const dispatch: RuntimeStateMachine<TState, TEvents>["dispatch"] = (event) =>
        machine
          .dispatch(event)
          .pipe(
            Effect.mapError((error) => runtimeErrorFromStateTransition(error, options.messages)),
          );

      return {
        state: machine.state,
        canDispatch: machine.canDispatch,
        dispatch,
      };
    },
  );
}

function runtimeErrorFromStateTransition<TState extends string, TEvent extends string>(
  error: StateTransitionError<TState, TEvent>,
  messages: RuntimeStateMachineMessages,
): RuntimeError {
  const message =
    error._tag === "InvalidStateTransition"
      ? messages.invalidTransition
      : messages.blockedTransition;

  return new RuntimeError({
    code: "ERR_INVALID_ARGUMENT",
    message: `${message}: ${error.state} -> ${error.event}`,
    details: {
      state: error.state,
      event: error.event,
    },
  });
}
