import { describe, expect, it } from "vitest";

import { StateMachine, type StateMachineTransitionTable } from "../src";

type TestState = "idle" | "ready" | "done";
type TestEvent = "prepare" | "finish";

interface TestContext {
  allowed: boolean;
  requestId: string;
}

describe("StateMachine", () => {
  it("blocks a transition when its guard returns false", () => {
    const transitions: StateMachineTransitionTable<TestState, TestEvent, TestContext> = {
      idle: {
        prepare: {
          target: "ready",
          guard: ({ context }) => context?.allowed === true,
        },
      },
      ready: {
        finish: "done",
      },
      done: {},
    };
    const machine = new StateMachine({
      initialState: "idle",
      transitions,
      invalidTransitionMessage: "Invalid test transition",
      blockedTransitionMessage: "Blocked test transition",
    });

    expect(machine.canDispatch("prepare", { allowed: false, requestId: "run-1" })).toBe(false);
    expect(() => machine.dispatch("prepare", { allowed: false, requestId: "run-1" })).toThrow(
      "Blocked test transition: idle -> prepare",
    );
    expect(machine.state).toBe("idle");
  });

  it("runs per-transition and global hooks after a successful transition", () => {
    const events: string[] = [];
    const transitions: StateMachineTransitionTable<TestState, TestEvent, TestContext> = {
      idle: {
        prepare: {
          target: "ready",
          guard: ({ context }) => context?.allowed === true,
          onTransition: ({ from, to, event, context }) => {
            events.push(`local:${context?.requestId}:${from}:${event}:${to}`);
          },
        },
      },
      ready: {
        finish: "done",
      },
      done: {},
    };
    const machine = new StateMachine({
      initialState: "idle",
      transitions,
      invalidTransitionMessage: "Invalid test transition",
      onTransition: ({ from, to, event, context }) => {
        events.push(`global:${context?.requestId}:${from}:${event}:${to}`);
      },
    });

    expect(machine.dispatch("prepare", { allowed: true, requestId: "run-2" })).toBe("ready");

    expect(events).toEqual(["local:run-2:idle:prepare:ready", "global:run-2:idle:prepare:ready"]);
  });

  it("awaits async guards, actions, and hooks when dispatchAsync is used", async () => {
    const events: string[] = [];
    const transitions: StateMachineTransitionTable<TestState, TestEvent, TestContext> = {
      idle: {
        prepare: {
          target: "ready",
          guard: async ({ context }) => context?.allowed === true,
          action: async ({ context }) => {
            events.push(`action:${context?.requestId}`);
          },
          onTransition: async ({ from, to, event, context }) => {
            events.push(`local:${context?.requestId}:${from}:${event}:${to}`);
          },
        },
      },
      ready: {
        finish: "done",
      },
      done: {},
    };
    const machine = new StateMachine({
      initialState: "idle",
      transitions,
      invalidTransitionMessage: "Invalid test transition",
      onTransition: async ({ from, to, event, context }) => {
        events.push(`global:${context?.requestId}:${from}:${event}:${to}`);
      },
    });

    await expect(
      machine.canDispatchAsync("prepare", { allowed: true, requestId: "run-3" }),
    ).resolves.toBe(true);
    await expect(
      machine.dispatchAsync("prepare", { allowed: true, requestId: "run-3" }),
    ).resolves.toBe("ready");

    expect(events).toEqual([
      "action:run-3",
      "local:run-3:idle:prepare:ready",
      "global:run-3:idle:prepare:ready",
    ]);
  });

  it("keeps state unchanged when an async guard blocks dispatchAsync", async () => {
    const transitions: StateMachineTransitionTable<TestState, TestEvent, TestContext> = {
      idle: {
        prepare: {
          target: "ready",
          guard: async ({ context }) => context?.allowed === true,
        },
      },
      ready: {
        finish: "done",
      },
      done: {},
    };
    const machine = new StateMachine({
      initialState: "idle",
      transitions,
      invalidTransitionMessage: "Invalid test transition",
      blockedTransitionMessage: "Blocked test transition",
    });

    await expect(
      machine.dispatchAsync("prepare", { allowed: false, requestId: "run-4" }),
    ).rejects.toThrow("Blocked test transition: idle -> prepare");
    expect(machine.state).toBe("idle");
  });

  it("rejects async guards from synchronous dispatch", () => {
    const transitions: StateMachineTransitionTable<TestState, TestEvent, TestContext> = {
      idle: {
        prepare: {
          target: "ready",
          guard: async () => true,
        },
      },
      ready: {
        finish: "done",
      },
      done: {},
    };
    const machine = new StateMachine({
      initialState: "idle",
      transitions,
      invalidTransitionMessage: "Invalid test transition",
    });

    expect(() => machine.dispatch("prepare", { allowed: true, requestId: "run-5" })).toThrow(
      "Async state machine guard requires dispatchAsync",
    );
  });
});
