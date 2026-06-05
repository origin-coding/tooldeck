import { mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  CommandService,
  CommandRegistry,
  type IndexedCommand,
  ManifestIndex,
  parseRawCommandInputFromCliArgs,
  PluginManager,
  resolveTooldeckPaths,
  scanPluginDirectory,
  type TooldeckPaths,
  type TooldeckRuntimeMode,
} from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
} from "@tooldeck/storage";
import { defineCommand } from "citty";
import type { CommandDef } from "citty";
import { consola } from "consola";

export interface CreateCliCommandOptions {
  workspaceRoot: string;
}

export interface ResolveCliRuntimePathsOptions {
  workspaceRoot: string;
  mode?: TooldeckRuntimeMode;
  plugins?: string;
  storage?: string;
}

export interface CliRuntimePaths {
  tooldeckPaths: TooldeckPaths;
  pluginsRoot: string;
  storagePath: string;
}

export interface RunCliCommandOptions {
  commandId: string;
  pluginsRoot: string;
  storagePath: string;
  input?: JsonObject;
  rawArgs?: string[];
}

export interface ListCliCommandsOptions {
  pluginsRoot: string;
}

export interface ListedCliCommand {
  id: string;
  pluginId: string;
  title: string;
}

export interface CreatePluginManagerOptions {
  pluginsRoot: string;
  createPluginStorage?: ConstructorParameters<typeof NodePluginHost>[0]["createPluginStorage"];
}

export interface CreatedPluginManager {
  pluginManager: PluginManager;
  commandService: CommandService;
  pluginHost: NodePluginHost;
  manifestIndex: ManifestIndex;
  pluginCount: number;
  commandCount: number;
}

export async function createPluginManager(
  options: CreatePluginManagerOptions,
): Promise<CreatedPluginManager> {
  const commandRegistry = new CommandRegistry();
  const pluginHost = new NodePluginHost({
    commandRegistry,
    createPluginStorage: options.createPluginStorage,
  });
  const manifestIndex = new ManifestIndex();

  const scanResult = await scanPluginDirectory({
    pluginsRoot: options.pluginsRoot,
    manifestIndex,
  });

  const pluginManager = new PluginManager({
    manifestIndex,
    commandRegistry,
    pluginHost,
  });

  return {
    pluginHost,
    manifestIndex,
    pluginCount: scanResult.pluginCount,
    commandCount: scanResult.commandCount,
    pluginManager,
    commandService: new CommandService({
      pluginManager,
      coercion: "cli",
    }),
  };
}

export function resolveCliRuntimePaths(options: ResolveCliRuntimePathsOptions): CliRuntimePaths {
  const tooldeckPaths = resolveTooldeckPaths({
    mode: options.mode ?? "development",
    workspaceRoot: options.workspaceRoot,
  });

  return {
    tooldeckPaths,
    pluginsRoot:
      resolveCliPathOverride(options.workspaceRoot, options.plugins) ??
      tooldeckPaths.builtinPluginsDir,
    storagePath:
      resolveCliPathOverride(options.workspaceRoot, options.storage) ?? tooldeckPaths.databasePath,
  };
}

export async function listCliCommands(
  options: ListCliCommandsOptions,
): Promise<ListedCliCommand[]> {
  const manifestIndex = new ManifestIndex();

  await scanPluginDirectory({
    pluginsRoot: options.pluginsRoot,
    manifestIndex,
  });

  return manifestIndex.listCommands().map(formatListedCommand);
}

export async function runCliCommandWithStorage(
  options: RunCliCommandOptions,
): Promise<CommandResult> {
  await mkdir(path.dirname(options.storagePath), { recursive: true });

  const database = openTooldeckDatabase({ path: options.storagePath });
  const commandRuns = new CommandRunRepository(database.db);
  const plugins = new PluginRepository(database.db);
  const pluginKv = new PluginKvRepository(database.db);
  const startedAt = performance.now();
  let pluginHost: NodePluginHost | undefined;
  let pluginId: string | undefined;
  let input = options.input;

  try {
    const created = await createPluginManager({
      pluginsRoot: options.pluginsRoot,
      createPluginStorage(pluginId) {
        return {
          async get(key) {
            return pluginKv.get(pluginId, key);
          },
          async set(key, value) {
            pluginKv.set({
              pluginId,
              key,
              value,
            });
          },
          async delete(key) {
            pluginKv.delete(pluginId, key);
          },
        };
      },
    });

    pluginHost = created.pluginHost;
    pluginId = created.manifestIndex.getCommandOwner(options.commandId);

    assertPluginsAvailable(created, options.pluginsRoot);
    for (const plugin of created.manifestIndex.listPlugins()) {
      plugins.upsertScannedPlugin({
        manifest: plugin.manifest,
        manifestPath: plugin.manifestPath,
      });
    }

    input ??= parseRawCommandInputFromCliArgs({
      rawArgs: options.rawArgs ?? [],
      commandId: options.commandId,
      ignoredOptions: ["plugins", "storage"],
    });
    const run = await created.commandService.runCommand({
      commandId: options.commandId,
      input,
    });
    input = run.input;

    commandRuns.create({
      commandId: options.commandId,
      pluginId,
      source: "cli",
      status: run.result.status,
      input,
      output: run.result,
      durationMs: elapsedMilliseconds(startedAt),
    });

    return run.result;
  } catch (error) {
    commandRuns.create({
      commandId: options.commandId,
      pluginId,
      source: "cli",
      status: "error",
      input,
      error: serializeError(error),
      durationMs: elapsedMilliseconds(startedAt),
    });

    throw error;
  } finally {
    await pluginHost?.disposeAll();
    database.close();
  }
}

export function printTextBlocks(result: CommandResult): void {
  for (const block of result.blocks) {
    if (block.type === "text") {
      consola.log(block.text);
    }
  }
}

export function printCommandList(commands: ListedCliCommand[]): void {
  consola.log("command id\tplugin id\ttitle");

  for (const command of commands) {
    consola.log(`${command.id}\t${command.pluginId}\t${command.title}`);
  }
}

export function printTooldeckPaths(paths: TooldeckPaths): void {
  const entries = [
    ["appInstallDir", paths.appInstallDir ?? ""],
    ["builtinPluginsDir", paths.builtinPluginsDir],
    ["userConfigDir", paths.userConfigDir],
    ["userDataDir", paths.userDataDir],
    ["databasePath", paths.databasePath],
    ["userPluginsDir", paths.userPluginsDir],
    ["pluginDataDir", paths.pluginDataDir],
    ["cacheDir", paths.cacheDir],
    ["logsDir", paths.logsDir],
    ["tempDir", paths.tempDir],
  ];

  for (const [key, value] of entries) {
    consola.log(`${key}\t${value}`);
  }
}

export function createCliCommand(options: CreateCliCommandOptions): CommandDef {
  return defineCommand({
    meta: {
      name: "tooldeck",
      description: "Command-line interface for Tooldeck.",
    },
    subCommands: {
      list: defineCommand({
        meta: {
          name: "list",
          description: "List Tooldeck resources.",
        },
        args: {
          resource: {
            type: "positional",
            required: false,
            description: "Resource type to list.",
            valueHint: "commands",
          },
          plugins: {
            type: "string",
            description: "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
            valueHint: "path",
          },
        },
        async run({ args }) {
          if (args.resource !== undefined && args.resource !== "commands") {
            throw new Error(`Unsupported list resource: ${args.resource}`);
          }

          const { pluginsRoot } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            plugins: args.plugins,
          });
          const commands = await listCliCommands({ pluginsRoot });

          printCommandList(commands);
        },
      }),
      run: defineCommand({
        meta: {
          name: "run",
          description: "Run a Tooldeck command.",
        },
        args: {
          commandId: {
            type: "positional",
            required: true,
            description: "Command id to run.",
            valueHint: "command",
          },
          plugins: {
            type: "string",
            description: "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
            valueHint: "path",
          },
          storage: {
            type: "string",
            description: "SQLite database path for command history.",
            valueHint: "path",
          },
        },
        async run({ args, rawArgs }) {
          const { pluginsRoot, storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            plugins: args.plugins,
            storage: args.storage,
          });
          const result = await runCliCommandWithStorage({
            commandId: args.commandId,
            pluginsRoot,
            storagePath,
            rawArgs,
          });

          printTextBlocks(result);
        },
      }),
      paths: defineCommand({
        meta: {
          name: "paths",
          description: "Print resolved Tooldeck paths.",
        },
        args: {
          plugins: {
            type: "string",
            description: "Plugin directory override to show.",
            valueHint: "path",
          },
          storage: {
            type: "string",
            description: "SQLite database path override to show.",
            valueHint: "path",
          },
        },
        run({ args }) {
          const { tooldeckPaths, pluginsRoot, storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            plugins: args.plugins,
            storage: args.storage,
          });

          printTooldeckPaths({
            ...tooldeckPaths,
            builtinPluginsDir: pluginsRoot,
            databasePath: storagePath,
          });
        },
      }),
    },
  });
}

function formatListedCommand(command: IndexedCommand): ListedCliCommand {
  return {
    id: command.id,
    pluginId: command.pluginId,
    title: resolveLocalizedString(command.definition.title),
  };
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function resolveCliPathOverride(workspaceRoot: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

function assertPluginsAvailable(created: CreatedPluginManager, pluginsRoot: string): void {
  if (created.pluginCount === 0) {
    throw new Error(`No plugins found in directory: ${pluginsRoot}`);
  }

  if (created.commandCount === 0) {
    throw new Error(`No commands found in plugin directory: ${pluginsRoot}`);
  }
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}
