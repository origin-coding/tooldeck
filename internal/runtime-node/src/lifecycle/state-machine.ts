import {
  makeStateMachine,
  mapStateMachineTransitionErrors,
  type MappedStateMachine,
  type StateEventName,
  type StateTransitionError,
  type StateTransitionTable,
} from "@tooldeck/state-machine";
import { Effect } from "effect";

import { RuntimeError } from "@/errors/error";

export interface RuntimeStateMachineMessages {
  readonly invalidTransition: string;
  readonly blockedTransition: string;
}

export interface RuntimeStateMachineOptions<TState extends string, TEvents extends object> {
  readonly initialState: TState;
  readonly transitions: StateTransitionTable<TState, TEvents>;
  readonly messages: RuntimeStateMachineMessages;
}

export type RuntimeStateMachine<TState extends string, TEvents extends object> = MappedStateMachine<
  TState,
  TEvents,
  RuntimeError
>;

export function makeRuntimeStateMachine<TState extends string, TEvents extends object>(
  options: RuntimeStateMachineOptions<TState, TEvents>,
): Effect.Effect<RuntimeStateMachine<TState, TEvents>> {
  return Effect.map(
    makeStateMachine<TState, TEvents>({
      initialState: options.initialState,
      transitions: options.transitions,
    }),
    (machine) =>
      mapStateMachineTransitionErrors(machine, (error) =>
        runtimeErrorFromStateTransition(error, options.messages),
      ),
  );
}

function runtimeErrorFromStateTransition<TState extends string, TEvents extends object>(
  error: StateTransitionError<TState, StateEventName<TEvents>>,
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
