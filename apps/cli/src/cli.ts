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
  type PluginRow,
} from "@tooldeck/storage";
import { defineCommand } from "citty";
import type { CommandDef } from "citty";
import { consola } from "consola";

import { formatCommandList, formatPluginList } from "./output";

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

export interface ListCliPluginsOptions {
  pluginsRoot: string;
  storagePath: string;
}

export interface SetCliPluginEnabledOptions {
  pluginId: string;
  enabled: boolean;
  pluginsRoot: string;
  storagePath: string;
}

export interface ListedCliCommand {
  id: string;
  pluginId: string;
  title: string;
  description?: string;
}

export interface ListedCliPlugin {
  id: string;
  enabled: boolean;
  version: string;
  manifestPath: string;
  name: string;
}

export type ListCliResource = "commands" | "plugins";

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

export async function listCliPlugins(options: ListCliPluginsOptions): Promise<ListedCliPlugin[]> {
  await mkdir(path.dirname(options.storagePath), { recursive: true });

  const database = openTooldeckDatabase({ path: options.storagePath });
  const plugins = new PluginRepository(database.db);

  try {
    await syncScannedPlugins({
      pluginsRoot: options.pluginsRoot,
      plugins,
    });

    return plugins.list().map(formatListedPlugin);
  } finally {
    database.close();
  }
}

export async function setCliPluginEnabled(
  options: SetCliPluginEnabledOptions,
): Promise<ListedCliPlugin> {
  await mkdir(path.dirname(options.storagePath), { recursive: true });

  const database = openTooldeckDatabase({ path: options.storagePath });
  const plugins = new PluginRepository(database.db);

  try {
    await syncScannedPlugins({
      pluginsRoot: options.pluginsRoot,
      plugins,
    });

    const plugin = plugins.setEnabled(options.pluginId, options.enabled);

    if (!plugin) {
      throw new Error(`Plugin is not registered: ${options.pluginId}`);
    }

    return formatListedPlugin(plugin);
  } finally {
    database.close();
  }
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
    syncScannedPluginIndex({
      manifestIndex: created.manifestIndex,
      plugins,
    });
    assertCommandPluginEnabled({
      commandId: options.commandId,
      pluginId,
      plugins,
    });

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

export function printContentBlocks(result: CommandResult): void {
  for (const block of result.blocks) {
    if (block.type === "text" || block.type === "code") {
      consola.log(block.text);
    } else if (block.type === "json") {
      consola.log(JSON.stringify(block.value, null, 2));
    }
  }
}

export function printCommandList(commands: ListedCliCommand[]): void {
  consola.log(formatCommandList(commands));
}

export function printPluginList(plugins: ListedCliPlugin[]): void {
  consola.log(formatPluginList(plugins));
}

export function printUnsupportedListResource(resource: string): void {
  consola.error(
    `Unsupported list resource: ${resource}\nSupported list resources: commands, plugins`,
  );
}

export function normalizeListCliResource(resource?: string): ListCliResource | undefined {
  if (resource === undefined || resource === "command" || resource === "commands") {
    return "commands";
  }

  if (resource === "plugin" || resource === "plugins") {
    return "plugins";
  }

  return undefined;
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
            valueHint: "commands|plugins",
          },
          plugins: {
            type: "string",
            description: "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
            valueHint: "path",
          },
          storage: {
            type: "string",
            description: "SQLite database path for plugin registry.",
            valueHint: "path",
          },
        },
        async run({ args }) {
          const resource = normalizeListCliResource(args.resource);
          const { pluginsRoot, storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            plugins: args.plugins,
            storage: args.storage,
          });

          if (resource === "commands") {
            const commands = await listCliCommands({ pluginsRoot });

            printCommandList(commands);
            return;
          }

          if (resource === "plugins" || resource === "plugin") {
            const plugins = await listCliPlugins({
              pluginsRoot,
              storagePath,
            });

            printPluginList(plugins);
            return;
          }

          printUnsupportedListResource(args.resource ?? "");
          process.exitCode = 1;
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

          printContentBlocks(result);
        },
      }),
      plugin: defineCommand({
        meta: {
          name: "plugin",
          description: "Manage Tooldeck plugins.",
        },
        subCommands: {
          list: defineCommand({
            meta: {
              name: "list",
              description: "List registered plugins.",
            },
            args: {
              plugins: {
                type: "string",
                description:
                  "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
                valueHint: "path",
              },
              storage: {
                type: "string",
                description: "SQLite database path for plugin registry.",
                valueHint: "path",
              },
            },
            async run({ args }) {
              const { pluginsRoot, storagePath } = resolveCliRuntimePaths({
                workspaceRoot: options.workspaceRoot,
                plugins: args.plugins,
                storage: args.storage,
              });
              const plugins = await listCliPlugins({
                pluginsRoot,
                storagePath,
              });

              printPluginList(plugins);
            },
          }),
          enable: defineCommand({
            meta: {
              name: "enable",
              description: "Enable a Tooldeck plugin.",
            },
            args: createPluginEnabledCommandArgs(),
            async run({ args }) {
              const { pluginsRoot, storagePath } = resolveCliRuntimePaths({
                workspaceRoot: options.workspaceRoot,
                plugins: args.plugins,
                storage: args.storage,
              });
              const plugin = await setCliPluginEnabled({
                pluginId: requireCliArgument(args.pluginId, "pluginId"),
                enabled: true,
                pluginsRoot,
                storagePath,
              });

              printPluginList([plugin]);
            },
          }),
          disable: defineCommand({
            meta: {
              name: "disable",
              description: "Disable a Tooldeck plugin.",
            },
            args: createPluginEnabledCommandArgs(),
            async run({ args }) {
              const { pluginsRoot, storagePath } = resolveCliRuntimePaths({
                workspaceRoot: options.workspaceRoot,
                plugins: args.plugins,
                storage: args.storage,
              });
              const plugin = await setCliPluginEnabled({
                pluginId: requireCliArgument(args.pluginId, "pluginId"),
                enabled: false,
                pluginsRoot,
                storagePath,
              });

              printPluginList([plugin]);
            },
          }),
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
  const description = command.definition.description
    ? resolveLocalizedString(command.definition.description)
    : undefined;

  return {
    id: command.id,
    pluginId: command.pluginId,
    title: resolveLocalizedString(command.definition.title),
    ...(description ? { description } : {}),
  };
}

function formatListedPlugin(plugin: PluginRow): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveStoredLocalizedString(plugin.nameJson),
  };
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function resolveStoredLocalizedString(value: string): string {
  try {
    return resolveLocalizedString(JSON.parse(value) as LocalizedString);
  } catch {
    return value;
  }
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

function requireCliArgument(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

interface SyncScannedPluginsOptions {
  pluginsRoot: string;
  plugins: PluginRepository;
}

async function syncScannedPlugins(options: SyncScannedPluginsOptions): Promise<ManifestIndex> {
  const manifestIndex = new ManifestIndex();

  await scanPluginDirectory({
    pluginsRoot: options.pluginsRoot,
    manifestIndex,
  });
  syncScannedPluginIndex({
    manifestIndex,
    plugins: options.plugins,
  });

  return manifestIndex;
}

interface SyncScannedPluginIndexOptions {
  manifestIndex: ManifestIndex;
  plugins: PluginRepository;
}

function syncScannedPluginIndex(options: SyncScannedPluginIndexOptions): void {
  options.plugins.syncScannedPlugins({
    plugins: options.manifestIndex.listPlugins().map((plugin) => ({
      manifest: plugin.manifest,
      manifestPath: plugin.manifestPath,
    })),
  });
}

interface AssertCommandPluginEnabledOptions {
  commandId: string;
  pluginId?: string;
  plugins: PluginRepository;
}

function assertCommandPluginEnabled(options: AssertCommandPluginEnabledOptions): void {
  if (!options.pluginId) {
    return;
  }

  const plugin = options.plugins.getById(options.pluginId);

  if (!plugin?.enabled) {
    throw new Error(`Plugin is disabled for command ${options.commandId}: ${options.pluginId}`);
  }
}

function createPluginEnabledCommandArgs() {
  return {
    pluginId: {
      type: "positional" as const,
      required: true,
      description: "Plugin id.",
      valueHint: "plugin",
    },
    plugins: {
      type: "string" as const,
      description: "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
      valueHint: "path",
    },
    storage: {
      type: "string" as const,
      description: "SQLite database path for plugin registry.",
      valueHint: "path",
    },
  };
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
