import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput, CommandRegistry, Disposable, PluginContextV1 } from "@tooldeck/sdk";
import { definePlugin } from "@tooldeck/sdk";
import { describe, expect, it } from "vitest";

interface TestCommandInputs {
  "test.echo": {
    text: string;
  };
}

class TestCommandRegistry implements CommandRegistry<TestCommandInputs> {
  readonly commands = new Map<
    string,
    (input: CommandInput) => Promise<CommandResult> | CommandResult
  >();

  register<TCommandId extends keyof TestCommandInputs & string>(
    commandId: TCommandId,
    handler: (input: TestCommandInputs[TCommandId]) => Promise<CommandResult> | CommandResult,
  ): Disposable {
    this.commands.set(
      commandId,
      handler as (input: CommandInput) => Promise<CommandResult> | CommandResult,
    );

    return {
      dispose: () => {
        this.commands.delete(commandId);
      },
    };
  }
}

function createContext(): PluginContextV1<TestCommandInputs> {
  return {
    pluginId: "dev.tooldeck.test",
    subscriptions: [],
    commands: new TestCommandRegistry(),
    storage: {
      async get() {
        return undefined;
      },
      async set() {},
      async delete() {},
    },
  };
}

function getCommand(ctx: PluginContextV1<TestCommandInputs>) {
  return (ctx.commands as TestCommandRegistry).commands.get("test.echo");
}

describe("definePlugin", () => {
  it("supports the builder-style plugin DSL", async () => {
    const plugin = definePlugin<TestCommandInputs>((pluginBuilder) => {
      pluginBuilder.command("test.echo", async (input) => ({
        status: "success",
        blocks: [
          {
            type: "text",
            text: input.text,
          },
        ],
      }));
    });
    const ctx = createContext();

    await plugin.activate(ctx);

    await expect(getCommand(ctx)?.({ text: "hello" })).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "hello",
        },
      ],
    });
    expect(ctx.subscriptions).toHaveLength(1);
  });

  it("supports object-style commands and lifecycle hooks", async () => {
    const calls: string[] = [];
    const plugin = definePlugin<TestCommandInputs>({
      commands: {
        "test.echo": async (input) => ({
          status: "success",
          blocks: [
            {
              type: "text",
              text: input.text,
            },
          ],
        }),
      },
      onActivate(ctx) {
        calls.push(`activate:${ctx.pluginId}`);
      },
      onDeactivate(ctx) {
        calls.push(`deactivate:${ctx.pluginId}`);
      },
    });
    const ctx = createContext();

    await plugin.activate(ctx);
    await plugin.deactivate?.(ctx);

    expect(calls).toEqual(["activate:dev.tooldeck.test", "deactivate:dev.tooldeck.test"]);
    expect(getCommand(ctx)).toBeDefined();
  });

  it("keeps the low-level activate API as an escape hatch", async () => {
    const plugin = definePlugin<TestCommandInputs>({
      activate(ctx) {
        ctx.subscriptions.push(
          ctx.commands.register("test.echo", async (input) => ({
            status: "success",
            blocks: [
              {
                type: "text",
                text: input.text,
              },
            ],
          })),
        );
      },
    });
    const ctx = createContext();

    await plugin.activate(ctx);

    expect(getCommand(ctx)).toBeDefined();
    expect(ctx.subscriptions).toHaveLength(1);
  });
});
