import { Context, Deferred, Effect, Exit, Fiber, Layer } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  BlockedStateTransition,
  InvalidStateTransition,
  mapStateMachineTransitionErrors,
  makeStateMachine,
  type MappedStateMachine,
  type StateEvent,
  type StateEventOf,
  type StateMachine,
  type StateTransitionError,
  type StateTransitionRecord,
  type StateTransitionTable,
} from "../src";

type TestState = "idle" | "ready" | "done";

interface TestEvents {
  readonly prepare: {
    readonly allowed: boolean;
    readonly requestId: string;
  };
  readonly finish: void;
}

describe("makeStateMachine", () => {
  it("derives payload and payload-free event variants from the Event Map", () => {
    expectTypeOf<StateEvent<TestEvents>>().toEqualTypeOf<
      | {
          readonly type: "prepare";
          readonly payload: {
            readonly allowed: boolean;
            readonly requestId: string;
          };
        }
      | { readonly type: "finish" }
    >();
    expectTypeOf<StateEventOf<TestEvents, "finish">>().toEqualTypeOf<{
      readonly type: "finish";
    }>();
  });

  it("checks invalid and guarded transitions without mutating state", async () => {
    const machine = await Effect.runPromise(
      makeStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
      }),
    );

    await expect(Effect.runPromise(machine.canDispatch(finishEvent()))).resolves.toBe(false);
    await expect(
      Effect.runPromise(machine.canDispatch(prepareEvent("blocked", false))),
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(machine.canDispatch(prepareEvent("allowed", true))),
    ).resolves.toBe(true);
    await expect(Effect.runPromise(machine.state)).resolves.toBe("idle");
  });

  it("uses structured neutral failures for invalid and blocked transitions", async () => {
    const machine = await Effect.runPromise(
      makeStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
      }),
    );

    await expect(
      Effect.runPromise(Effect.flip(machine.dispatch(finishEvent()))),
    ).resolves.toMatchObject({
      _tag: "InvalidStateTransition",
      state: "idle",
      event: "finish",
    });
    await expect(
      Effect.runPromise(Effect.flip(machine.dispatch(prepareEvent("blocked", false)))),
    ).resolves.toMatchObject({
      _tag: "BlockedStateTransition",
      state: "idle",
      event: "prepare",
    });
    await expect(Effect.runPromise(machine.state)).resolves.toBe("idle");
  });

  it("commits state and returns the complete event in the transition record", async () => {
    const machine = await Effect.runPromise(
      makeStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
      }),
    );
    const event = prepareEvent("transition-record", true);

    await expect(Effect.runPromise(machine.dispatch(event))).resolves.toEqual({
      from: "idle",
      to: "ready",
      event,
    });
    await expect(Effect.runPromise(machine.state)).resolves.toBe("ready");
  });

  it("keeps guard failures in the typed channel without committing state", async () => {
    const guardFailure = new Error("guard failed");
    const machine = await Effect.runPromise(
      makeStateMachine<TestState, TestEvents, Error>({
        initialState: "idle",
        transitions: {
          idle: {
            prepare: {
              target: "ready",
              guard: () => Effect.fail(guardFailure),
            },
          },
          ready: { finish: "done" },
          done: {},
        },
      }),
    );

    await expect(
      Effect.runPromise(Effect.flip(machine.dispatch(prepareEvent("failure", true)))),
    ).resolves.toBe(guardFailure);
    await expect(Effect.runPromise(machine.state)).resolves.toBe("idle");
  });

  it("maps neutral transition errors while preserving guard failures and requirements", async () => {
    class TransitionGate extends Context.Tag("test/MappedTransitionGate")<
      TransitionGate,
      { readonly allowed: boolean }
    >() {}

    interface GuardFailure {
      readonly _tag: "GuardFailure";
      readonly reason: string;
    }

    interface OwnedTransitionFailure {
      readonly _tag: "OwnedTransitionFailure";
      readonly state: TestState;
      readonly event: keyof TestEvents;
    }

    const guardFailure: GuardFailure = {
      _tag: "GuardFailure",
      reason: "transition gate rejected the request",
    };
    const transitions: StateTransitionTable<TestState, TestEvents, GuardFailure, TransitionGate> = {
      idle: {
        prepare: {
          target: "ready",
          guard: () =>
            Effect.flatMap(TransitionGate, ({ allowed }) =>
              allowed ? Effect.succeed(true) : Effect.fail(guardFailure),
            ),
        },
      },
      ready: { finish: "done" },
      done: {},
    };
    const machine = await Effect.runPromise(
      makeStateMachine({ initialState: "idle" as TestState, transitions }),
    );
    const mapped: MappedStateMachine<
      TestState,
      TestEvents,
      OwnedTransitionFailure,
      GuardFailure,
      TransitionGate
    > = mapStateMachineTransitionErrors(
      machine,
      (error: StateTransitionError<TestState, keyof TestEvents>): OwnedTransitionFailure => ({
        _tag: "OwnedTransitionFailure",
        state: error.state,
        event: error.event,
      }),
    );
    const prepare = mapped.dispatch(prepareEvent("mapped-guard", true));

    expectTypeOf(prepare).toEqualTypeOf<
      Effect.Effect<
        StateTransitionRecord<TestState, StateEventOf<TestEvents, "prepare">>,
        OwnedTransitionFailure | GuardFailure,
        TransitionGate
      >
    >();

    await expect(
      Effect.runPromise(
        Effect.flip(prepare).pipe(Effect.provideService(TransitionGate, { allowed: false })),
      ),
    ).resolves.toBe(guardFailure);
    await expect(
      Effect.runPromise(
        Effect.flip(mapped.dispatch(finishEvent())).pipe(
          Effect.provideService(TransitionGate, { allowed: true }),
        ),
      ),
    ).resolves.toEqual({
      _tag: "OwnedTransitionFailure",
      state: "idle",
      event: "finish",
    });
    await expect(Effect.runPromise(mapped.state)).resolves.toBe("idle");
  });

  it("serializes concurrent guard evaluation and state commits", async () => {
    const guardEntered = await Effect.runPromise(Deferred.make<void>());
    const releaseGuard = await Effect.runPromise(Deferred.make<void>());
    const machine = await Effect.runPromise(
      makeStateMachine<TestState, TestEvents>({
        initialState: "idle",
        transitions: {
          idle: {
            prepare: {
              target: "ready",
              guard: () =>
                Deferred.succeed(guardEntered, undefined).pipe(
                  Effect.zipRight(Deferred.await(releaseGuard)),
                  Effect.as(true),
                ),
            },
          },
          ready: { finish: "done" },
          done: {},
        },
      }),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const prepareFiber = yield* Effect.fork(machine.dispatch(prepareEvent("concurrent", true)));
        yield* Deferred.await(guardEntered);
        const finishFiber = yield* Effect.fork(machine.dispatch(finishEvent()));
        yield* Effect.yieldNow();

        expect(yield* machine.state).toBe("idle");

        yield* Deferred.succeed(releaseGuard, undefined);
        const prepared = yield* Fiber.join(prepareFiber);
        const finished = yield* Fiber.join(finishFiber);

        expect(prepared.to).toBe("ready");
        expect(prepared.event.type).toBe("prepare");
        expect(finished.to).toBe("done");
        expect(finished.event.type).toBe("finish");
      }),
    );

    await expect(Effect.runPromise(machine.state)).resolves.toBe("done");
  });

  it("does not commit when interrupted inside a guard", async () => {
    const guardEntered = await Effect.runPromise(Deferred.make<void>());
    const machine = await Effect.runPromise(
      makeStateMachine<TestState, TestEvents>({
        initialState: "idle",
        transitions: {
          idle: {
            prepare: {
              target: "ready",
              guard: () =>
                Deferred.succeed(guardEntered, undefined).pipe(Effect.zipRight(Effect.never)),
            },
          },
          ready: { finish: "done" },
          done: {},
        },
      }),
    );

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(machine.dispatch(prepareEvent("interrupt", true)));
        yield* Deferred.await(guardEntered);
        return yield* Fiber.interrupt(fiber);
      }),
    );

    expect(Exit.isInterrupted(exit)).toBe(true);
    await expect(Effect.runPromise(machine.state)).resolves.toBe("idle");
  });

  it("removes an interrupted transition while it waits for the serialization permit", async () => {
    const guardEntered = await Effect.runPromise(Deferred.make<void>());
    const releaseGuard = await Effect.runPromise(Deferred.make<void>());
    const machine = await Effect.runPromise(
      makeStateMachine<TestState, TestEvents>({
        initialState: "idle",
        transitions: {
          idle: {
            prepare: {
              target: "ready",
              guard: () =>
                Deferred.succeed(guardEntered, undefined).pipe(
                  Effect.zipRight(Deferred.await(releaseGuard)),
                  Effect.as(true),
                ),
            },
          },
          ready: { finish: "done" },
          done: {},
        },
      }),
    );

    const waitingExit = await Effect.runPromise(
      Effect.gen(function* () {
        const prepareFiber = yield* Effect.fork(machine.dispatch(prepareEvent("waiting", true)));
        yield* Deferred.await(guardEntered);
        const finishFiber = yield* Effect.fork(machine.dispatch(finishEvent()));
        yield* Effect.yieldNow();
        const exit = yield* Fiber.interrupt(finishFiber);
        yield* Deferred.succeed(releaseGuard, undefined);
        yield* Fiber.join(prepareFiber);
        return exit;
      }),
    );

    expect(Exit.isInterrupted(waitingExit)).toBe(true);
    await expect(Effect.runPromise(machine.state)).resolves.toBe("ready");
  });

  it("keeps Effect requirements visible for future Context and Layer composition", async () => {
    class TransitionGate extends Context.Tag("test/TransitionGate")<
      TransitionGate,
      { readonly allowed: boolean }
    >() {}

    class TestStateMachine extends Context.Tag("test/StateMachine")<
      TestStateMachine,
      StateMachine<TestState, TestEvents, never, TransitionGate>
    >() {}

    const transitions: StateTransitionTable<TestState, TestEvents, never, TransitionGate> = {
      idle: {
        prepare: {
          target: "ready",
          guard: ({ event }) =>
            Effect.map(TransitionGate, ({ allowed }) => allowed && event.payload.allowed),
        },
      },
      ready: { finish: "done" },
      done: {},
    };
    const machineLayer = Layer.effect(
      TestStateMachine,
      makeStateMachine({ initialState: "idle" as TestState, transitions }),
    );
    const program = Effect.gen(function* () {
      const machine = yield* TestStateMachine;
      return yield* machine.dispatch(prepareEvent("layer", true));
    });

    expectTypeOf(program).toEqualTypeOf<
      Effect.Effect<
        StateTransitionRecord<TestState, StateEventOf<TestEvents, "prepare">>,
        InvalidStateTransition<TestState, "prepare"> | BlockedStateTransition<TestState, "prepare">,
        TestStateMachine | TransitionGate
      >
    >();

    await expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(machineLayer),
          Effect.provideService(TransitionGate, { allowed: true }),
        ),
      ),
    ).resolves.toEqual({
      from: "idle",
      to: "ready",
      event: prepareEvent("layer", true),
    });
  });
});

function prepareEvent(requestId: string, allowed: boolean): StateEventOf<TestEvents, "prepare"> {
  return {
    type: "prepare",
    payload: { requestId, allowed },
  };
}

function finishEvent(): StateEventOf<TestEvents, "finish"> {
  return { type: "finish" };
}

function testTransitions(): StateTransitionTable<TestState, TestEvents> {
  return {
    idle: {
      prepare: {
        target: "ready",
        guard: ({ event }) => Effect.succeed(event.payload.allowed),
      },
    },
    ready: { finish: "done" },
    done: {},
  };
}

function assertDispatchTyping(machine: StateMachine<TestState, TestEvents>): void {
  void machine.dispatch(prepareEvent("typed", true));
  void machine.dispatch(finishEvent());

  // @ts-expect-error prepare requires its mapped payload.
  void machine.dispatch({ type: "prepare" });

  // @ts-expect-error finish derives an event with no payload field.
  void machine.dispatch({ type: "finish", payload: { allowed: true, requestId: "invalid" } });

  // @ts-expect-error prepare payload must match TestEvents["prepare"].
  void machine.dispatch({ type: "prepare", payload: { requestId: "invalid" } });
}

void assertDispatchTyping;
