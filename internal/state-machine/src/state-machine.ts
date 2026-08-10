import { Effect, Ref } from "effect";

import { BlockedStateTransition, InvalidStateTransition } from "./errors";
import type {
  StateEventName,
  StateEventOf,
  StateMachine,
  StateMachineOptions,
  StateTransitionDefinition,
  StateTransitionRecord,
} from "./model";

export function makeStateMachine<
  TState extends string,
  TEvents extends object,
  TFailure = never,
  TRequirements = never,
>(
  options: StateMachineOptions<TState, TEvents, TFailure, TRequirements>,
): Effect.Effect<StateMachine<TState, TEvents, TFailure, TRequirements>> {
  return Effect.gen(function* () {
    const state = yield* Ref.make(options.initialState);
    const transitionPermit = yield* Effect.makeSemaphore(1);

    const canDispatch: StateMachine<TState, TEvents, TFailure, TRequirements>["canDispatch"] = (
      event,
    ) =>
      transitionPermit.withPermits(1)(
        Effect.gen(function* () {
          const from = yield* Ref.get(state);
          const definition = getTransitionDefinition(options, from, event.type);

          if (!definition) {
            return false;
          }

          if (!definition.guard) {
            return true;
          }

          return yield* definition.guard(createTransitionRecord(from, definition.target, event));
        }),
      );

    const dispatch: StateMachine<TState, TEvents, TFailure, TRequirements>["dispatch"] = (event) =>
      transitionPermit.withPermits(1)(
        // Permit acquisition stays interruptible. Once acquired, the mask
        // makes the successful guard-to-commit-and-return boundary atomic with
        // respect to interruption; guard evaluation remains interruptible.
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            const from = yield* Ref.get(state);
            const definition = getTransitionDefinition(options, from, event.type);

            if (!definition) {
              return yield* Effect.fail(
                new InvalidStateTransition<TState, typeof event.type>({
                  state: from,
                  event: event.type,
                }),
              );
            }

            const transition = createTransitionRecord(from, definition.target, event);

            if (definition.guard && !(yield* restore(definition.guard(transition)))) {
              return yield* Effect.fail(
                new BlockedStateTransition<TState, typeof event.type>({
                  state: from,
                  event: event.type,
                }),
              );
            }

            yield* Ref.set(state, definition.target);

            return transition;
          }),
        ),
      );

    return {
      state: Ref.get(state),
      canDispatch,
      dispatch,
    };
  });
}

function getTransitionDefinition<
  TState extends string,
  TEvents extends object,
  TEvent extends StateEventName<TEvents>,
  TFailure,
  TRequirements,
>(
  options: StateMachineOptions<TState, TEvents, TFailure, TRequirements>,
  state: TState,
  event: TEvent,
): StateTransitionDefinition<TState, TEvents, TEvent, TFailure, TRequirements> | undefined {
  const transition = options.transitions[state][event];

  if (!transition) {
    return undefined;
  }

  return typeof transition === "string"
    ? { target: transition as TState }
    : (transition as StateTransitionDefinition<TState, TEvents, TEvent, TFailure, TRequirements>);
}

function createTransitionRecord<
  TState extends string,
  TEvents extends object,
  TEvent extends StateEventName<TEvents>,
>(
  from: TState,
  to: TState,
  event: StateEventOf<TEvents, TEvent>,
): StateTransitionRecord<TState, StateEventOf<TEvents, TEvent>> {
  return {
    from,
    to,
    event,
  };
}
