import { mkdtempSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CommandRunRepository, openTooldeckDatabase } from "@tooldeck/storage";
import { afterEach, describe, expect, it } from "vitest";

import { createPluginManager, runCliCommandWithStorage } from "../src/cli";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("CLI command support", () => {
  it("runs hello.world from the default plugin directory shape", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const { pluginManager, pluginHost, pluginCount, commandCount } = await createPluginManager({
      pluginsRoot,
    });

    try {
      await expect(pluginManager.runCommand({ commandId: "hello.world" })).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "Hello, world!",
          },
        ],
      });

      expect(pluginCount).toBeGreaterThanOrEqual(1);
      expect(commandCount).toBeGreaterThanOrEqual(1);
    } finally {
      await pluginHost.disposeAll();
    }
  });

  it("returns no plugins for an empty plugin directory", async ({ task }) => {
    const pluginsRoot = path.join(".tmp", "cli-tests", task.id, "plugins");

    await mkdir(pluginsRoot, { recursive: true });

    const { pluginHost, pluginCount, commandCount } = await createPluginManager({
      pluginsRoot,
    });

    try {
      expect(pluginCount).toBe(0);
      expect(commandCount).toBe(0);
    } finally {
      await pluginHost.disposeAll();
    }
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
          type: "text",
          text: '{\n  "a": 1\n}',
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
    expect(JSON.parse(runs[0]?.outputJson ?? "")).toMatchObject({
      blocks: [
        {
          text: '{\n  "a": 1\n}',
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
    expect(runs[0]?.outputJson).toContain("ERR_INVALID_JSON");
  });
});

function createDatabasePath(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-cli-"));
  tempDirs.push(dir);
  return path.join(dir, "test.sqlite");
}

function readCommandRuns(storagePath: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new CommandRunRepository(database.db);

  try {
    return repository.listRecent();
  } finally {
    database.close();
  }
}
