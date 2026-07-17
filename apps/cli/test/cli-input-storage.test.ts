import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, it, describe } from "vitest";

import { runCliCommandWithStorage } from "../src/cli";
import {
  createDatabasePath,
  createTempDir,
  readCommandRuns,
  readPluginKvValue,
} from "./cli-test-fixtures";

describe("CLI command input and plugin storage", () => {
  it("runs commands with repeated CLI options as array inputs", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "controls-test");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.controls-test",
        name: "Controls Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "controls.echo",
              title: "Echo Controls",
              inputSchema: {
                type: "object",
                required: ["mode"],
                additionalProperties: false,
                properties: {
                  enabled: {
                    type: "boolean",
                    default: false,
                    "x-ui": {
                      control: "checkbox",
                    },
                  },
                  mode: {
                    type: "string",
                    enum: ["text", "code"],
                    "x-ui": {
                      control: "radio",
                    },
                  },
                  flags: {
                    type: "array",
                    default: [],
                    uniqueItems: true,
                    items: {
                      type: "string",
                      enum: ["g", "i", "m"],
                    },
                    "x-ui": {
                      control: "checkboxGroup",
                    },
                  },
                },
              },
            },
          ],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        export default {
          activate(ctx) {
            ctx.subscriptions.push(
              ctx.commands.register("controls.echo", (input) => ({
                status: "success",
                blocks: [{ type: "json", value: input }],
              })),
            );
          },
        };
      `,
      "utf8",
    );

    await expect(
      runCliCommandWithStorage({
        commandId: "controls.echo",
        pluginsRoot,
        storagePath,
        rawArgs: ["controls.echo", "--enabled", "--mode", "code", "--flags", "g", "--flags=i"],
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "json",
          value: {
            enabled: true,
            mode: "code",
            flags: ["g", "i"],
          },
        },
      ],
    });

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "controls.echo",
      pluginId: "dev.tooldeck.controls-test",
      source: "cli",
      status: "success",
    });
    expect(runs[0]?.inputJson).toBe(
      JSON.stringify({
        enabled: true,
        mode: "code",
        flags: ["g", "i"],
      }),
    );
  });

  it("backs plugin ctx.storage with SQLite plugin KV", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "kv-test");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.kv-test",
        name: "KV Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "kv.increment",
              title: "Increment KV",
            },
          ],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        export default {
          activate(ctx) {
            ctx.subscriptions.push(
              ctx.commands.register("kv.increment", async () => {
                const current = (await ctx.storage.get("count")) ?? 0;
                const next = current + 1;

                await ctx.storage.set("count", next);

                return {
                  status: "success",
                  blocks: [{ type: "text", text: String(next) }],
                };
              }),
            );
          },
        };
      `,
      "utf8",
    );

    await expect(
      runCliCommandWithStorage({
        commandId: "kv.increment",
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      blocks: [{ text: "1" }],
    });
    await expect(
      runCliCommandWithStorage({
        commandId: "kv.increment",
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      blocks: [{ text: "2" }],
    });

    expect(readPluginKvValue(storagePath, "dev.tooldeck.kv-test", "count")).toBe(2);
  });
});
