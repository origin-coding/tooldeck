import type { Effect } from "effect";

import type { StateTransitionError } from "./errors";

export interface StateEventEnvelope {
  readonly type: string;
}

export type StateEventName<TEvents extends object> = Extract<keyof TEvents, string>;

export type StateEvent<TEvents extends object> = {
  readonly [TEvent in StateEventName<TEvents>]: [TEvents[TEvent]] extends [void]
    ? { readonly type: TEvent }
    : {
        readonly type: TEvent;
        readonly payload: TEvents[TEvent];
      };
}[StateEventName<TEvents>];

export type StateEventOf<TEvents extends object, TEvent extends StateEventName<TEvents>> = Extract<
  StateEvent<TEvents>,
  { readonly type: TEvent }
>;

export interface StateTransitionRecord<TState extends string, TEvent extends StateEventEnvelope> {
  readonly from: TState;
  readonly to: TState;
  readonly event: TEvent;
}

export type StateTransitionGuard<
  TState extends string,
  TEvents extends object,
  TEvent extends StateEventName<TEvents>,
  TFailure = never,
  TRequirements = never,
> = (
  transition: StateTransitionRecord<TState, StateEventOf<TEvents, TEvent>>,
) => Effect.Effect<boolean, TFailure, TRequirements>;

export interface StateTransitionDefinition<
  TState extends string,
  TEvents extends object,
  TEvent extends StateEventName<TEvents>,
  TFailure = never,
  TRequirements = never,
> {
  readonly target: TState;
  readonly guard?: StateTransitionGuard<TState, TEvents, TEvent, TFailure, TRequirements>;
}

export type StateTransitionRule<
  TState extends string,
  TEvents extends object,
  TEvent extends StateEventName<TEvents>,
  TFailure = never,
  TRequirements = never,
> = TState | StateTransitionDefinition<TState, TEvents, TEvent, TFailure, TRequirements>;

export type StateTransitionTable<
  TState extends string,
  TEvents extends object,
  TFailure = never,
  TRequirements = never,
> = {
  readonly [State in TState]: {
    readonly [TEvent in StateEventName<TEvents>]?: StateTransitionRule<
      TState,
      TEvents,
      TEvent,
      TFailure,
      TRequirements
    >;
  };
};

export interface StateMachineOptions<
  TState extends string,
  TEvents extends object,
  TFailure = never,
  TRequirements = never,
> {
  readonly initialState: TState;
  readonly transitions: StateTransitionTable<TState, TEvents, TFailure, TRequirements>;
}

export interface StateMachine<
  TState extends string,
  TEvents extends object,
  TFailure = never,
  TRequirements = never,
> {
  /** Reads the current state when the Effect is executed. */
  readonly state: Effect.Effect<TState>;

  /**
   * Checks the transition and its guard against a serialized state snapshot.
   * The result is advisory: another fiber may transition the machine before a
   * later dispatch acquires the permit.
   */
  readonly canDispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => Effect.Effect<boolean, TFailure, TRequirements>;

  /**
   * Serializes guard evaluation and state commit, then returns the committed
   * transition as data. Guard failure or interruption leaves the state
   * unchanged. Once the guard succeeds, commit and result delivery form an
   * uninterruptible boundary.
   *
   * Business effects, resource ownership, observation, and compensation are
   * deliberately composed by the owning service after dispatch.
   */
  readonly dispatch: <TEvent extends StateEventName<TEvents>>(
    event: StateEventOf<TEvents, TEvent>,
  ) => Effect.Effect<
    StateTransitionRecord<TState, StateEventOf<TEvents, TEvent>>,
    StateTransitionError<TState, TEvent> | TFailure,
    TRequirements
  >;
}
