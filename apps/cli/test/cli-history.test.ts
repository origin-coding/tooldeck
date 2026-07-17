import path from "node:path";

import { expect, it, describe } from "vitest";

import { runCliCommandWithStorage, setCliPreference } from "../src/cli";
import { createDatabasePath, readCommandRuns, readPlugins } from "./cli-test-fixtures";

describe("CLI command history", () => {
  it("can disable CLI command history through preferences", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await setCliPreference({
      key: "command.history.enabled",
      value: false,
      storagePath,
    });

    await expect(
      runCliCommandWithStorage({
        commandId: "hello.world",
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "Hello, world!",
        },
      ],
    });

    expect(readCommandRuns(storagePath)).toHaveLength(0);
  });

  it("stores successful command runs in SQLite", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await expect(
      runCliCommandWithStorage({
        commandId: "hello.world",
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "Hello, world!",
        },
      ],
    });

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "hello.world",
      pluginId: "dev.tooldeck.hello-world",
      source: "cli",
      status: "success",
    });
    expect(runs[0]?.durationMs).toEqual(expect.any(Number));
    expect(runs[0]?.outputJson).toContain("Hello, world!");

    const plugins = readPlugins(storagePath);

    expect(plugins.some((plugin) => plugin.id === "dev.tooldeck.hello-world")).toBe(true);
    expect(plugins.some((plugin) => plugin.id === "dev.tooldeck.json-tools")).toBe(true);
  });

  it("stores failed command runs in SQLite", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await expect(
      runCliCommandWithStorage({
        commandId: "hello.missing",
        pluginsRoot,
        storagePath,
      }),
    ).rejects.toThrow("Command is not contributed by any plugin: hello.missing");

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "hello.missing",
      pluginId: null,
      source: "cli",
      status: "error",
    });
    expect(runs[0]?.durationMs).toEqual(expect.any(Number));
    expect(runs[0]?.errorJson).toContain("hello.missing");
  });

  it("runs json.format with text input and stores the command run", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await expect(
      runCliCommandWithStorage({
        commandId: "json.format",
        pluginsRoot,
        storagePath,
        rawArgs: ["json.format", "--text", '{"a":1}', "--indent", "2"],
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "code",
          text: '{\n  "a": 1\n}',
          language: "json",
        },
      ],
    });

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "json.format",
      pluginId: "dev.tooldeck.json-tools",
      source: "cli",
      status: "success",
    });
    expect(runs[0]?.inputJson).toBe(JSON.stringify({ text: '{"a":1}', indent: 2 }));
    expect(runs[0]?.errorJson).toBeNull();
    expect(JSON.parse(runs[0]?.outputJson ?? "")).toEqual({
      status: "success",
      blocks: [
        {
          text: '{\n  "a": 1\n}',
          type: "code",
          language: "json",
        },
      ],
    });
  });

  it("stores json.format error results in SQLite", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    const result = await runCliCommandWithStorage({
      commandId: "json.format",
      pluginsRoot,
      storagePath,
      rawArgs: ["json.format", "--text", "{"],
    });

    expect(result.status).toBe("error");
    expect(result.error).toMatchObject({
      code: "ERR_INVALID_JSON",
    });

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "json.format",
      pluginId: "dev.tooldeck.json-tools",
      source: "cli",
      status: "error",
    });
    expect(runs[0]?.inputJson).toBe(JSON.stringify({ text: "{", indent: 2 }));
    expect(runs[0]?.errorJson).toBeNull();
    expect(JSON.parse(runs[0]?.outputJson ?? "")).toMatchObject({
      status: "error",
      blocks: [
        {
          type: "text",
          text: expect.stringContaining("Invalid JSON:"),
        },
      ],
      error: {
        code: "ERR_INVALID_JSON",
        message: expect.any(String),
      },
    });
  });
});
