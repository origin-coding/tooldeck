import type { StateTransitionTable } from "@tooldeck/state-machine";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeApplicationStateMachine } from "@/application/application-state-machine";
import { runApplicationEffect } from "@/application/edge";

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

describe("makeApplicationStateMachine", () => {
  it("maps neutral invalid and blocked failures to ApplicationError", async () => {
    const machine = await runApplicationEffect(
      makeApplicationStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
        messages,
      }),
    );

    await expect(runApplicationEffect(machine.dispatch({ type: "finish" }))).rejects.toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Invalid test transition: idle -> finish",
      details: { state: "idle", event: "finish" },
    });
    await expect(
      runApplicationEffect(machine.dispatch({ type: "prepare", payload: { allowed: false } })),
    ).rejects.toMatchObject({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Blocked test transition: idle -> prepare",
      details: { state: "idle", event: "prepare" },
    });
    await expect(runApplicationEffect(machine.state)).resolves.toBe("idle");
  });

  it("returns the neutral transition record after a successful Application dispatch", async () => {
    const machine = await runApplicationEffect(
      makeApplicationStateMachine({
        initialState: "idle" as TestState,
        transitions: testTransitions(),
        messages,
      }),
    );
    const event = { type: "prepare" as const, payload: { allowed: true } };

    await expect(runApplicationEffect(machine.dispatch(event))).resolves.toEqual({
      from: "idle",
      to: "ready",
      event,
    });
    await expect(runApplicationEffect(machine.state)).resolves.toBe("ready");
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
