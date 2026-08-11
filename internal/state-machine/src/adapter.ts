import { Effect } from "effect";

import { isStateTransitionError, type StateTransitionError } from "./errors";
import type { StateEventName, StateEventOf, StateMachine, StateTransitionRecord } from "./model";

export interface MappedStateMachine<
  TState extends string,
  TEvents extends object,
  TMappedTransitionFailure,
  TGuardFailure = never,
  TRequirements = never,
> {
  readonly state: Effect.Effect<TState>;
  readonly canDispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => Effect.Effect<boolean, TGuardFailure, TRequirements>;
  readonly dispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => Effect.Effect<
    StateTransitionRecord<TState, StateEventOf<TEvents, TEvent>>,
    TMappedTransitionFailure | TGuardFailure,
    TRequirements
  >;
}

export type StateTransitionErrorMapper<
  TState extends string,
  TEvents extends object,
  TMappedTransitionFailure,
> = (error: StateTransitionError<TState, StateEventName<TEvents>>) => TMappedTransitionFailure;

export function mapStateMachineTransitionErrors<
  TState extends string,
  TEvents extends object,
  TMappedTransitionFailure,
  TGuardFailure = never,
  TRequirements = never,
>(
  machine: StateMachine<TState, TEvents, TGuardFailure, TRequirements>,
  mapTransitionError: StateTransitionErrorMapper<TState, TEvents, TMappedTransitionFailure>,
): MappedStateMachine<TState, TEvents, TMappedTransitionFailure, TGuardFailure, TRequirements> {
  const dispatch: MappedStateMachine<
    TState,
    TEvents,
    TMappedTransitionFailure,
    TGuardFailure,
    TRequirements
  >["dispatch"] = (event) =>
    machine
      .dispatch(event)
      .pipe(
        Effect.mapError((error) =>
          mapStateMachineError<TState, TEvents, TMappedTransitionFailure, TGuardFailure>(
            error,
            mapTransitionError,
          ),
        ),
      );

  return {
    state: machine.state,
    canDispatch: machine.canDispatch,
    dispatch,
  };
}

function mapStateMachineError<
  TState extends string,
  TEvents extends object,
  TMappedTransitionFailure,
  TGuardFailure,
>(
  error: StateTransitionError<TState, StateEventName<TEvents>> | TGuardFailure,
  mapTransitionError: StateTransitionErrorMapper<TState, TEvents, TMappedTransitionFailure>,
): TMappedTransitionFailure | TGuardFailure {
  return isStateTransitionError(error)
    ? mapTransitionError(error as StateTransitionError<TState, StateEventName<TEvents>>)
    : (error as TGuardFailure);
}
