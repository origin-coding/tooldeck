import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CommandRunRepository,
  openTooldeckDatabase,
  PreferenceRepository,
  PluginKvRepository,
  PluginRepository,
} from "@tooldeck/storage";
import { afterEach, describe, expect, it } from "vitest";

import {
  createPluginManager,
  deleteCliPreference,
  getCliPreference,
  listCliPreferences,
  listCliCommands,
  listCliPlugins,
  normalizeListCliResource,
  parseCliPluginDirArgs,
  parsePreferenceJson,
  resolveCliRuntimePaths,
  resolveCliPluginDirOption,
  runCliCommandWithStorage,
  setCliPreference,
  setCliPluginEnabled,
} from "../src/cli";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("CLI command support", () => {
  it("resolves default CLI runtime paths from Tooldeck paths", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "plugins"));
    expect(paths.storagePath).toContain("tooldeck.sqlite");
    expect(paths.storagePath).not.toBe(path.join(workspaceRoot, ".data", "tooldeck.sqlite"));
  });

  it("resolves relative CLI path overrides against the workspace root", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      plugins: "./fixtures/plugins",
      storage: "./.data/test.sqlite",
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "fixtures", "plugins"));
    expect(paths.storagePath).toBe(path.join(workspaceRoot, ".data", "test.sqlite"));
  });

  it("resolves bundled builtin plugins in production mode", () => {
    const appInstallDir = path.resolve("app", "cli", "dist");
    const builtinPluginsDir = path.join(appInstallDir, "plugins");
    const paths = resolveCliRuntimePaths({
      appInstallDir,
      builtinPluginsDir,
      mode: "production",
      workspaceRoot: path.resolve("workspace"),
    });

    expect(paths.pluginsRoot).toBe(builtinPluginsDir);
    expect(paths.tooldeckPaths.appInstallDir).toBe(appInstallDir);
  });

  it("preserves absolute CLI path overrides", () => {
    const workspaceRoot = path.resolve("workspace");
    const pluginsRoot = path.resolve("external", "plugins");
    const storagePath = path.resolve("external", "data", "tooldeck.sqlite");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      plugins: pluginsRoot,
      storage: storagePath,
    });

    expect(paths.pluginsRoot).toBe(pluginsRoot);
    expect(paths.storagePath).toBe(storagePath);
  });

  it("resolves additional plugin dirs as external scan sources", () => {
    const workspaceRoot = path.resolve("workspace");
    const paths = resolveCliRuntimePaths({
      workspaceRoot,
      pluginDir: ["../external-a", "../external-b"],
    });

    expect(paths.pluginsRoot).toBe(path.join(workspaceRoot, "plugins"));
    expect(paths.pluginSources).toEqual([
      {
        kind: "builtin",
        path: path.join(workspaceRoot, "plugins"),
      },
      {
        kind: "external",
        path: path.resolve(workspaceRoot, "../external-a"),
      },
      {
        kind: "external",
        path: path.resolve(workspaceRoot, "../external-b"),
      },
    ]);
  });

  it("parses repeated --plugin-dir arguments from raw CLI args", () => {
    const rawArgs = [
      "run",
      "hello.world",
      "--plugin-dir",
      "../external-a",
      "--plugin-dir=../external-b",
    ];

    expect(parseCliPluginDirArgs(rawArgs)).toEqual(["../external-a", "../external-b"]);
    expect(
      resolveCliPluginDirOption({
        rawArgs,
        value: "../last-only",
      }),
    ).toEqual(["../external-a", "../external-b"]);
  });

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

  it("lists no commands for an empty plugin directory", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");

    await mkdir(pluginsRoot, { recursive: true });

    await expect(listCliCommands({ pluginsRoot })).resolves.toEqual([]);
  });

  it("normalizes list resources and rejects unsupported resources", () => {
    expect(normalizeListCliResource()).toBe("commands");
    expect(normalizeListCliResource("command")).toBe("commands");
    expect(normalizeListCliResource("commands")).toBe("commands");
    expect(normalizeListCliResource("plugin")).toBe("plugins");
    expect(normalizeListCliResource("plugins")).toBe("plugins");
    expect(normalizeListCliResource("preference")).toBe("preferences");
    expect(normalizeListCliResource("preferences")).toBe("preferences");
    expect(normalizeListCliResource("documents")).toBeUndefined();
  });

  it("lists manifest commands without activating plugin code", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "list-test");
    const activationMarkerPath = path.join(pluginRoot, "activated.txt");

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.list-test",
        name: "List Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "list.localized",
              title: {
                key: "commands.localized.title",
                default: "Localized Command",
              },
            },
            {
              id: "list.string",
              title: "String Command",
            },
          ],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        import { writeFile } from "node:fs/promises";

        await writeFile(${JSON.stringify(activationMarkerPath)}, "activated", "utf8");

        export default {
          activate() {},
        };
      `,
      "utf8",
    );

    await expect(listCliCommands({ pluginsRoot })).resolves.toEqual([
      {
        id: "list.localized",
        pluginId: "dev.tooldeck.list-test",
        title: "Localized Command",
      },
      {
        id: "list.string",
        pluginId: "dev.tooldeck.list-test",
        title: "String Command",
      },
    ]);
    expect(existsSync(activationMarkerPath)).toBe(false);
  });

  it("lists and runs commands from additional plugin sources", async () => {
    const builtinRoot = path.resolve("../..", "plugins");
    const externalRoot = path.join(createTempDir(), "external-echo");
    const storagePath = createDatabasePath();
    const pluginSources = [
      {
        kind: "builtin" as const,
        path: builtinRoot,
      },
      {
        kind: "external" as const,
        path: externalRoot,
      },
    ];

    await createEchoPlugin({
      commandId: "external.echo",
      pluginId: "dev.tooldeck.external-echo",
      pluginRoot: externalRoot,
      responseText: "external ok",
    });

    await expect(listCliCommands({ pluginSources })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hello.world",
          pluginId: "dev.tooldeck.hello-world",
        }),
        expect.objectContaining({
          id: "external.echo",
          pluginId: "dev.tooldeck.external-echo",
        }),
      ]),
    );

    await expect(
      runCliCommandWithStorage({
        commandId: "external.echo",
        pluginSources,
        storagePath,
      }),
    ).resolves.toEqual({
      status: "success",
      blocks: [
        {
          type: "text",
          text: "external ok",
        },
      ],
    });

    expect(readCommandRuns(storagePath)).toEqual([
      expect.objectContaining({
        commandId: "external.echo",
        pluginId: "dev.tooldeck.external-echo",
        source: "cli",
        status: "success",
      }),
    ]);
  });

  it("lists scanned plugins through the SQLite plugin registry", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    const plugins = await listCliPlugins({
      pluginsRoot,
      storagePath,
    });

    expect(plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "dev.tooldeck.hello-world",
          enabled: true,
          name: "Hello World",
        }),
        expect.objectContaining({
          id: "dev.tooldeck.json-tools",
          enabled: true,
          name: "JSON Tools",
        }),
      ]),
    );
    expect(readPlugins(storagePath).map((plugin) => plugin.id)).toEqual(
      expect.arrayContaining(["dev.tooldeck.hello-world", "dev.tooldeck.json-tools"]),
    );
  });

  it("enables and disables plugins in the SQLite plugin registry", async () => {
    const pluginsRoot = path.resolve("../..", "plugins");
    const storagePath = createDatabasePath();

    await expect(
      setCliPluginEnabled({
        pluginId: "dev.tooldeck.hello-world",
        enabled: false,
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      id: "dev.tooldeck.hello-world",
      enabled: false,
    });
    await expect(
      setCliPluginEnabled({
        pluginId: "dev.tooldeck.hello-world",
        enabled: true,
        pluginsRoot,
        storagePath,
      }),
    ).resolves.toMatchObject({
      id: "dev.tooldeck.hello-world",
      enabled: true,
    });
  });

  it("stores and lists known preferences with defaults", async () => {
    const storagePath = createDatabasePath();

    await expect(
      setCliPreference({
        key: "output.format",
        value: "json",
        storagePath,
      }),
    ).resolves.toMatchObject({
      scope: "cli",
      key: "output.format",
      value: "json",
      updatedAt: expect.any(Number),
    });

    await expect(
      setCliPreference({
        key: "locale",
        value: "zh-CN",
        storagePath,
      }),
    ).resolves.toMatchObject({
      scope: "shared",
      key: "locale",
      value: "zh-CN",
    });

    await expect(listCliPreferences({ storagePath })).resolves.toEqual([
      expect.objectContaining({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
      }),
      expect.objectContaining({
        scope: "cli",
        key: "output.format",
        value: "json",
      }),
      expect.objectContaining({
        scope: "cli",
        key: "command.history.enabled",
        value: true,
      }),
      expect.objectContaining({
        scope: "desktop",
        key: "navigation.mode",
        value: "provider-first",
      }),
      expect.objectContaining({
        scope: "desktop",
        key: "sidebar.collapsed",
        value: false,
      }),
    ]);
    expect(readPreferenceValue(storagePath, "cli", "output.format")).toBe("json");
    expect(readPreferenceValue(storagePath, "shared", "locale")).toBe("zh-CN");
    expect(readPreferenceValue(storagePath, "cli", "command.history.enabled")).toBeUndefined();
  });

  it("rejects unsupported preference keys and invalid values", async () => {
    const storagePath = createDatabasePath();

    await expect(
      setCliPreference({
        key: "json.indent",
        value: 4,
        storagePath,
      }),
    ).rejects.toThrow("Unsupported preference key: json.indent");

    await expect(
      setCliPreference({
        key: "output.format",
        value: "yaml",
        storagePath,
      }),
    ).rejects.toThrow("Preference output.format must be one of: text, json");

    await expect(
      setCliPreference({
        key: "command.history.enabled",
        value: "false",
        storagePath,
      }),
    ).rejects.toThrow("Preference command.history.enabled must be a boolean value");
  });

  it("deletes known preferences by scope and falls back to defaults", async () => {
    const storagePath = createDatabasePath();

    await setCliPreference({
      key: "locale",
      value: "en-US",
      storagePath,
    });
    await deleteCliPreference({
      key: "locale",
      storagePath,
    });

    await expect(
      getCliPreference({
        key: "locale",
        storagePath,
      }),
    ).resolves.toBe("system");
    expect(readPreferenceValue(storagePath, "shared", "locale")).toBeUndefined();
  });

  it("parses preference values as JSON", () => {
    expect(parsePreferenceJson('"dark"')).toBe("dark");
    expect(parsePreferenceJson("4")).toBe(4);
    expect(parsePreferenceJson('{"theme":"dark"}')).toEqual({ theme: "dark" });
    expect(() => parsePreferenceJson("dark")).toThrow("Preference value must be valid JSON");
  });

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

  it("does not activate disabled plugins when running commands", async () => {
    const pluginsRoot = path.join(createTempDir(), "plugins");
    const pluginRoot = path.join(pluginsRoot, "disabled-test");
    const activationMarkerPath = path.join(pluginRoot, "activated.txt");
    const storagePath = createDatabasePath();

    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "manifest.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        id: "dev.tooldeck.disabled-test",
        name: "Disabled Test",
        version: "0.0.0",
        runtime: {
          kind: "node",
          entry: "./index.mjs",
        },
        contributes: {
          commands: [
            {
              id: "disabled.run",
              title: "Disabled Run",
            },
          ],
        },
      }),
      "utf8",
    );
    await writeFile(
      path.join(pluginRoot, "index.mjs"),
      `
        import { writeFile } from "node:fs/promises";

        export default {
          async activate(ctx) {
            await writeFile(${JSON.stringify(activationMarkerPath)}, "activated", "utf8");
            ctx.subscriptions.push(
              ctx.commands.register("disabled.run", () => ({
                status: "success",
                blocks: [{ type: "text", text: "should not run" }],
              })),
            );
          },
        };
      `,
      "utf8",
    );

    await setCliPluginEnabled({
      pluginId: "dev.tooldeck.disabled-test",
      enabled: false,
      pluginsRoot,
      storagePath,
    });

    await expect(
      runCliCommandWithStorage({
        commandId: "disabled.run",
        pluginsRoot,
        storagePath,
      }),
    ).rejects.toThrow("Plugin is disabled for command disabled.run: dev.tooldeck.disabled-test");
    expect(existsSync(activationMarkerPath)).toBe(false);

    const runs = readCommandRuns(storagePath);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      commandId: "disabled.run",
      pluginId: "dev.tooldeck.disabled-test",
      source: "cli",
      status: "error",
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

function createDatabasePath(): string {
  return path.join(createTempDir(), "test.sqlite");
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-cli-"));

  tempDirs.push(dir);

  return dir;
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

function readPlugins(storagePath: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PluginRepository(database.db);

  try {
    return repository.list();
  } finally {
    database.close();
  }
}

function readPreferenceValue(
  storagePath: string,
  scope: "desktop" | "cli" | "shared",
  key: string,
) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PreferenceRepository(database.db);

  try {
    return repository.get(scope, key);
  } finally {
    database.close();
  }
}

function readPluginKvValue(storagePath: string, pluginId: string, key: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PluginKvRepository(database.db);

  try {
    return repository.get(pluginId, key);
  } finally {
    database.close();
  }
}

async function createEchoPlugin(options: {
  commandId: string;
  pluginId: string;
  pluginRoot: string;
  responseText: string;
}): Promise<void> {
  await mkdir(options.pluginRoot, { recursive: true });
  await writeFile(
    path.join(options.pluginRoot, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "External Echo",
      version: "0.0.0",
      runtime: {
        kind: "node",
        entry: "./index.mjs",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "External Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(options.pluginRoot, "index.mjs"),
    `
      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: ${JSON.stringify(options.responseText)} }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
}
