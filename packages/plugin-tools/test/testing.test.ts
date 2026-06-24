import type { PluginManifest } from "@tooldeck/protocol";
import { describe, expect, it } from "vitest";

import { createPluginTestHost, type PluginTestPlugin } from "../src/testing";

interface TestCommandInputs {
  "test.echo": {
    text: string;
  };
  "test.count": {
    key: string;
  };
}

describe("createPluginTestHost", () => {
  it("activates a plugin and runs registered commands", async () => {
    const plugin: PluginTestPlugin<TestCommandInputs> = {
      activate(ctx) {
        ctx.subscriptions.push(
          ctx.commands.register("test.echo", (input) => ({
            status: "success",
            blocks: [{ type: "text", text: input.text }],
          })),
        );
      },
    };

    const host = await createPluginTestHost(plugin, createManifest());

    await expect(host.runCommand("test.echo", { text: "hello" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "text", text: "hello" }],
    });
    expect(host.context.pluginId).toBe("dev.tooldeck.test-tools");
    expect(host.commands).toEqual(["test.echo"]);

    await host.dispose();
  });

  it("supports direct command registration for focused handler tests", async () => {
    const host = await createPluginTestHost<TestCommandInputs>({
      activate() {},
    });
    const disposable = host.registerCommand("test.echo", (input) => ({
      status: "success",
      blocks: [{ type: "code", language: "text", text: input.text }],
    }));

    await expect(host.runCommand("test.echo", { text: "hello" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "code", language: "text", text: "hello" }],
    });

    await disposable.dispose();
    await expect(host.runCommand("test.echo", { text: "hello" })).rejects.toThrow(
      "Command is not registered: test.echo",
    );

    await host.dispose();
  });

  it("provides mock plugin storage and logger", async () => {
    const plugin: PluginTestPlugin<TestCommandInputs> = {
      activate(ctx) {
        ctx.subscriptions.push(
          ctx.commands.register("test.count", async (input) => {
            const value = Number((await ctx.storage.get(input.key)) ?? 0) + 1;

            await ctx.storage.set(input.key, value);
            ctx.logger.info("counted", input.key, value);

            return {
              status: "success",
              blocks: [{ type: "json", value }],
            };
          }),
        );
      },
    };
    const host = await createPluginTestHost(plugin, {
      pluginId: "test.storage",
      storage: {
        runs: 1,
      },
    });

    await expect(host.runCommand("test.count", { key: "runs" })).resolves.toEqual({
      status: "success",
      blocks: [{ type: "json", value: 2 }],
    });
    await expect(host.storage.get("runs")).resolves.toBe(2);
    expect(host.storage.snapshot()).toEqual({ runs: 2 });
    expect(host.logger.entries).toEqual([
      {
        level: "info",
        message: "counted",
        args: ["runs", 2],
      },
    ]);

    await host.dispose();
  });

  it("disposes subscriptions in reverse registration order", async () => {
    const disposed: string[] = [];
    const plugin: PluginTestPlugin<TestCommandInputs> = {
      activate(ctx) {
        ctx.subscriptions.push(
          {
            dispose() {
              disposed.push("first");
            },
          },
          ctx.commands.register("test.echo", (input) => ({
            status: "success",
            blocks: [{ type: "text", text: input.text }],
          })),
          {
            dispose() {
              disposed.push("last");
            },
          },
        );
      },
      deactivate() {
        disposed.push("deactivate");
      },
    };
    const host = await createPluginTestHost(plugin);

    await host.dispose();

    expect(disposed).toEqual(["deactivate", "last", "first"]);
    await expect(host.runCommand("test.echo", { text: "hello" })).rejects.toThrow(
      "Plugin test host has been disposed.",
    );
  });

  it("rejects malformed command results", async () => {
    const host = await createPluginTestHost<TestCommandInputs>({
      activate(ctx) {
        ctx.subscriptions.push(
          ctx.commands.register("test.echo", () => ({
            status: "success",
            blocks: [{ type: "text", text: 1 }],
          }) as never),
        );
      },
    });

    await expect(host.runCommand("test.echo", { text: "hello" })).rejects.toThrow(
      "Invalid command result for test.echo: --blocks[0].text expected string, received number.",
    );

    await host.dispose();
  });
});

function createManifest(): PluginManifest {
  return {
    schemaVersion: "1.0",
    id: "dev.tooldeck.test-tools",
    name: "Test Tools",
    version: "0.0.0",
    runtime: {
      kind: "node",
      entry: "./dist/index.js",
    },
  };
}
