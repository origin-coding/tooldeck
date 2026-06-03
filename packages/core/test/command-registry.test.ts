import { describe, expect, it } from "vitest";

import { CommandRegistry } from "../src";

describe("CommandRegistry", () => {
  it("registers and lists commands", () => {
    const registry = new CommandRegistry();

    registry.register("json.format", () => ({
      status: "success",
      blocks: [{ type: "text", text: "formatted" }],
    }));

    expect(registry.has("json.format")).toBe(true);
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.id).toBe("json.format");
  });

  it("runs a registered command", async () => {
    const registry = new CommandRegistry();

    registry.register("json.echo", (input) => ({
      status: "success",
      blocks: [{ type: "text", text: String(input.text) }],
    }));

    await expect(
      registry.run({
        commandId: "json.echo",
        input: { text: "hello" },
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "hello" }],
    });
  });

  it("throws when a handler returns an invalid command result", async () => {
    const registry = new CommandRegistry();

    registry.register(
      "json.bad-result",
      () =>
        ({
          status: "success",
          blocks: [{ type: "text", text: 1 }],
        }) as never,
    );

    await expect(registry.run({ commandId: "json.bad-result" })).rejects.toThrow(
      "Invalid command result for json.bad-result: --blocks[0].text",
    );
  });

  it("throws when registering a duplicate command", () => {
    const registry = new CommandRegistry();

    registry.register("json.format", () => ({
      status: "success",
      blocks: [],
    }));

    expect(() =>
      registry.register("json.format", () => ({
        status: "success",
        blocks: [],
      })),
    ).toThrow("Command is already registered: json.format");
  });

  it("throws when running an unknown command", async () => {
    const registry = new CommandRegistry();

    await expect(registry.run({ commandId: "json.missing" })).rejects.toThrow(
      "Command is not registered: json.missing",
    );
  });

  it("unregisters a command when its disposable is disposed", () => {
    const registry = new CommandRegistry();

    const disposable = registry.register("json.format", () => ({
      status: "success",
      blocks: [],
    }));

    disposable.dispose();

    expect(registry.has("json.format")).toBe(false);
    expect(registry.list()).toHaveLength(0);
  });

  it("does not remove a later registration when disposing a stale disposable", () => {
    const registry = new CommandRegistry();

    const staleDisposable = registry.register("json.format", () => ({
      status: "success",
      blocks: [{ type: "text", text: "first" }],
    }));

    staleDisposable.dispose();

    registry.register("json.format", () => ({
      status: "success",
      blocks: [{ type: "text", text: "second" }],
    }));

    staleDisposable.dispose();

    expect(registry.has("json.format")).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it("wraps successful command execution with tryRun", async () => {
    const registry = new CommandRegistry();

    registry.register("json.format", () => ({
      status: "success",
      blocks: [{ type: "text", text: "formatted" }],
    }));

    await expect(registry.tryRun({ commandId: "json.format" })).resolves.toEqual({
      ok: true,
      result: {
        status: "success",
        blocks: [{ type: "text", text: "formatted" }],
      },
    });
  });

  it("wraps unknown command errors with tryRun", async () => {
    const registry = new CommandRegistry();

    await expect(registry.tryRun({ commandId: "json.missing" })).resolves.toMatchObject({
      ok: false,
      error: {
        code: "ERR_COMMAND_NOT_FOUND",
        message: "Command is not registered: json.missing",
      },
      result: {
        status: "error",
        blocks: [],
        error: {
          code: "ERR_COMMAND_NOT_FOUND",
          message: "Command is not registered: json.missing",
        },
      },
    });
  });

  it("wraps thrown handler errors with tryRun", async () => {
    const registry = new CommandRegistry();

    registry.register("json.fail", () => {
      throw new Error("Invalid JSON");
    });

    await expect(registry.tryRun({ commandId: "json.fail" })).resolves.toMatchObject({
      ok: false,
      error: {
        code: "ERR_UNKNOWN",
        message: "Invalid JSON",
      },
      result: {
        status: "error",
        blocks: [],
        error: {
          code: "ERR_UNKNOWN",
          message: "Invalid JSON",
        },
      },
    });
  });

  it("wraps invalid command results with tryRun", async () => {
    const registry = new CommandRegistry();

    registry.register(
      "json.bad-result",
      () =>
        ({
          status: "success",
          blocks: [{ type: "unknown" }],
        }) as never,
    );

    await expect(registry.tryRun({ commandId: "json.bad-result" })).resolves.toMatchObject({
      ok: false,
      error: {
        code: "ERR_COMMAND_FAILED",
        message: "Invalid command result for json.bad-result: --blocks[0].type",
      },
      result: {
        status: "error",
        blocks: [],
        error: {
          code: "ERR_COMMAND_FAILED",
          message: "Invalid command result for json.bad-result: --blocks[0].type",
        },
      },
    });
  });
});
