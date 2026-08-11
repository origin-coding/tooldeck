import {
  makeStateMachine,
  mapStateMachineTransitionErrors,
  type MappedStateMachine,
  type StateEventName,
  type StateTransitionError,
  type StateTransitionTable,
} from "@tooldeck/state-machine";
import { Effect } from "effect";

import { ApplicationError } from "@/errors/application-error";

export interface ApplicationStateMachineMessages {
  readonly invalidTransition: string;
  readonly blockedTransition: string;
}

export interface ApplicationStateMachineOptions<TState extends string, TEvents extends object> {
  readonly initialState: TState;
  readonly transitions: StateTransitionTable<TState, TEvents>;
  readonly messages: ApplicationStateMachineMessages;
}

export type ApplicationStateMachine<
  TState extends string,
  TEvents extends object,
> = MappedStateMachine<TState, TEvents, ApplicationError>;

export function makeApplicationStateMachine<TState extends string, TEvents extends object>(
  options: ApplicationStateMachineOptions<TState, TEvents>,
): Effect.Effect<ApplicationStateMachine<TState, TEvents>> {
  return Effect.map(
    makeStateMachine<TState, TEvents>({
      initialState: options.initialState,
      transitions: options.transitions,
    }),
    (machine) =>
      mapStateMachineTransitionErrors(machine, (error) =>
        applicationErrorFromStateTransition(error, options.messages),
      ),
  );
}

function applicationErrorFromStateTransition<TState extends string, TEvents extends object>(
  error: StateTransitionError<TState, StateEventName<TEvents>>,
  messages: ApplicationStateMachineMessages,
): ApplicationError {
  const message =
    error._tag === "InvalidStateTransition"
      ? messages.invalidTransition
      : messages.blockedTransition;

  return new ApplicationError({
    source: "application",
    code: "ERR_INVALID_ARGUMENT",
    message: `${message}: ${error.state} -> ${error.event}`,
    details: {
      state: error.state,
      event: error.event,
    },
  });
}
