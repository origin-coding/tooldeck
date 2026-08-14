import type { StateTransitionTable } from "@tooldeck/state-machine";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { describe, expect, it } from "vitest";

import { runRuntimeEffectPromise, runRuntimeEffectSync } from "@/effect";
import { makeRuntimeStateMachine } from "@/lifecycle/state-machine";

type TestState = "idle" | "ready" | "done";

interface TestEvents {
  readonly prepare: {
    readonly allowed: boolean;
  };
  readonly finish: void;
}

const messages = {
  invalidTransition: "Invalid test transition",
  blockedTransition: "Blocked test transition",
};

describe("makeRuntimeStateMachine", () => {
  it("maps neutral invalid and blocked failures to RuntimeError", async () => {
    const machine = await runRuntimeEffectPromise(
      makeRuntimeStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
        messages,
      }),
    );

    expect(() => runRuntimeEffectSync(machine.dispatch({ type: "finish" }))).toThrowError(
      expect.objectContaining({
        code: "ERR_INVALID_ARGUMENT",
        message: "Invalid test transition: idle -> finish",
        details: { state: "idle", event: "finish" },
      }),
    );
    await expect(
      runRuntimeEffectPromise(machine.dispatch({ type: "prepare", payload: { allowed: false } })),
    ).rejects.toMatchObject({
      code: "ERR_INVALID_ARGUMENT",
      message: "Blocked test transition: idle -> prepare",
      details: { state: "idle", event: "prepare" },
    });
    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("idle");
  });

  it("returns the neutral transition record after a successful Runtime dispatch", async () => {
    const machine = await runRuntimeEffectPromise(
      makeRuntimeStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
        messages,
      }),
    );
    const event = { type: "prepare" as const, payload: { allowed: true } };

    await expect(runRuntimeEffectPromise(machine.dispatch(event))).resolves.toEqual({
      from: "idle",
      to: "ready",
      event,
    });
    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("ready");
  });

  it("preserves serialized dispatch through the Runtime adapter", async () => {
    const guardEntered = await Effect.runPromise(Deferred.make<void>());
    const releaseGuard = await Effect.runPromise(Deferred.make<void>());
    const machine = await runRuntimeEffectPromise(
      makeRuntimeStateMachine<TestState, TestEvents>({
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
        messages,
      }),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const prepareFiber = yield* Effect.fork(
          machine.dispatch({ type: "prepare", payload: { allowed: true } }),
        );
        yield* Deferred.await(guardEntered);
        const finishFiber = yield* Effect.fork(machine.dispatch({ type: "finish" }));

        yield* Deferred.succeed(releaseGuard, undefined);

        expect((yield* Fiber.join(prepareFiber)).to).toBe("ready");
        expect((yield* Fiber.join(finishFiber)).to).toBe("done");
      }),
    );
  });

  it("does not commit an interrupted Runtime transition guard", async () => {
    const guardEntered = await Effect.runPromise(Deferred.make<void>());
    const machine = await runRuntimeEffectPromise(
      makeRuntimeStateMachine<TestState, TestEvents>({
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
        messages,
      }),
    );

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.fork(
          machine.dispatch({ type: "prepare", payload: { allowed: true } }),
        );
        yield* Deferred.await(guardEntered);
        return yield* Fiber.interrupt(fiber);
      }),
    );

    expect(Exit.isInterrupted(exit)).toBe(true);
    await expect(runRuntimeEffectPromise(machine.state)).resolves.toBe("idle");
  });
});

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
