import { performance } from "node:perf_hooks";

import {
  RuntimeCommandRegistry,
  CommandService,
  type IndexedCommand,
  ManifestIndex,
  parseRawCommandInputFromCliArgs,
  PluginManager,
  scanPluginSources,
  type PluginScanSource,
} from "@tooldeck/runtime-node";
import { NodePluginHost } from "@tooldeck/host-node";
import type {
  CommandResult,
  LocalizedString,
  PropertiesContentBlock,
  PropertyValue,
} from "@tooldeck/protocol";
import { validatePreferenceValue } from "@tooldeck/preferences";
import type { JsonObject } from "@tooldeck/shared";
import {
  CommandRunRepository,
  PreferenceRepository,
  PluginKvRepository,
  PluginRepository,
  withTooldeckDatabase,
} from "@tooldeck/storage";
import { defineCommand } from "citty";
import { consola } from "consola";

import { formatCommandList } from "./output";
import { listCliPlugins, printPluginList } from "./plugins";
import {
  getCliOutputFormat,
  listCliPreferences,
  printPreferenceList,
  type CliOutputFormat,
} from "./preferences";
import {
  createPluginDirCommandArg,
  createPluginsCommandArg,
  createStorageCommandArg,
  resolveCliPluginDirOption,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

export interface RunCliCommandOptions {
  commandId: string;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
  input?: JsonObject;
  rawArgs?: string[];
}

export interface ListCliCommandsOptions {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
}

export interface ListedCliCommand {
  id: string;
  pluginId: string;
  title: string;
  description?: string;
}

export type ListCliResource = "commands" | "plugins" | "preferences";

export interface CreatePluginManagerOptions {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
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
  const commandRegistry = new RuntimeCommandRegistry();
  const pluginHost = new NodePluginHost({
    commandRegistry,
    createPluginStorage: options.createPluginStorage,
  });
  const manifestIndex = new ManifestIndex();
  const pluginSources = resolvePluginSources(options);

  const scanResult = await scanPluginSources({
    sources: pluginSources,
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

export async function listCliCommands(
  options: ListCliCommandsOptions,
): Promise<ListedCliCommand[]> {
  const manifestIndex = new ManifestIndex();

  await scanPluginSources({
    sources: resolvePluginSources(options),
    manifestIndex,
  });

  return manifestIndex.listCommands().map(formatListedCommand);
}

export async function runCliCommandWithStorage(
  options: RunCliCommandOptions,
): Promise<CommandResult> {
  return withTooldeckDatabase({ path: options.storagePath }, async (database) => {
    const commandRuns = new CommandRunRepository(database.db);
    const preferences = new PreferenceRepository(database.db);
    const plugins = new PluginRepository(database.db);
    const pluginKv = new PluginKvRepository(database.db);
    const recordCommandHistory = getCommandHistoryEnabled(preferences);
    const startedAt = performance.now();
    let pluginHost: NodePluginHost | undefined;
    let pluginId: string | undefined;
    let input = options.input;

    try {
      const created = await createPluginManager({
        pluginSources: resolvePluginSources(options),
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

      assertPluginsAvailable(created, resolvePluginSources(options));
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
        ignoredOptions: ["plugins", "plugin-dir", "pluginDir", "storage"],
      });
      const run = await created.commandService.runCommand({
        commandId: options.commandId,
        input,
      });
      input = run.input;

      if (recordCommandHistory) {
        commandRuns.create({
          commandId: options.commandId,
          pluginId,
          source: "cli",
          status: run.result.status,
          input,
          output: run.result,
          durationMs: elapsedMilliseconds(startedAt),
        });
      }

      return run.result;
    } catch (error) {
      if (recordCommandHistory) {
        commandRuns.create({
          commandId: options.commandId,
          pluginId,
          source: "cli",
          status: "error",
          input,
          error: serializeError(error),
          durationMs: elapsedMilliseconds(startedAt),
        });
      }

      throw error;
    } finally {
      await pluginHost?.disposeAll();
    }
  });
}

export function defineListCommand(options: CreateCliCommandOptions) {
  return defineCommand({
    meta: {
      name: "list",
      description: "List Tooldeck resources.",
    },
    args: {
      resource: {
        type: "positional",
        required: false,
        description: "Resource type to list.",
        valueHint: "commands|plugins|preferences",
      },
      plugins: createPluginsCommandArg(),
      pluginDir: createPluginDirCommandArg(),
      storage: createStorageCommandArg("SQLite database path for plugin registry."),
    },
    async run({ args, rawArgs }) {
      const resource = normalizeListCliResource(args.resource);
      const { pluginSources, storagePath } = resolveCliRuntimePaths({
        ...options,
        pluginDir: resolveCliPluginDirOption({
          rawArgs,
          value: args.pluginDir,
        }),
        plugins: args.plugins,
        storage: args.storage,
      });

      if (resource === "commands") {
        const commands = await listCliCommands({ pluginSources });
        const outputFormat = await getCliOutputFormat({ storagePath });

        printCommandList(commands, outputFormat);
        return;
      }

      if (resource === "plugins") {
        const plugins = await listCliPlugins({
          pluginSources,
          storagePath,
        });
        const outputFormat = await getCliOutputFormat({ storagePath });

        printPluginList(plugins, outputFormat);
        return;
      }

      if (resource === "preferences") {
        const preferences = await listCliPreferences({
          storagePath,
        });
        const outputFormat = await getCliOutputFormat({ storagePath });

        printPreferenceList(preferences, outputFormat);
        return;
      }

      printUnsupportedListResource(args.resource ?? "");
      process.exitCode = 1;
    },
  });
}

export function defineRunCommand(options: CreateCliCommandOptions) {
  return defineCommand({
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
      plugins: createPluginsCommandArg(),
      pluginDir: createPluginDirCommandArg(),
      storage: createStorageCommandArg("SQLite database path for command history."),
    },
    async run({ args, rawArgs }) {
      const { pluginSources, storagePath } = resolveCliRuntimePaths({
        ...options,
        pluginDir: resolveCliPluginDirOption({
          rawArgs,
          value: args.pluginDir,
        }),
        plugins: args.plugins,
        storage: args.storage,
      });
      const result = await runCliCommandWithStorage({
        commandId: args.commandId,
        pluginSources,
        storagePath,
        rawArgs,
      });
      const outputFormat = await getCliOutputFormat({ storagePath });

      printContentBlocks(result, outputFormat);
    },
  });
}

export function printContentBlocks(
  result: CommandResult,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const block of result.blocks) {
    if (block.type === "text" || block.type === "code") {
      consola.log(block.text);
    } else if (block.type === "json") {
      consola.log(JSON.stringify(block.value, null, 2));
    } else if (block.type === "properties") {
      consola.log(formatPropertiesBlock(block));
    }
  }
}

export function printCommandList(
  commands: ListedCliCommand[],
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(commands, null, 2));
    return;
  }

  consola.log(formatCommandList(commands));
}

export function printUnsupportedListResource(resource: string): void {
  consola.error(
    `Unsupported list resource: ${resource}\nSupported list resources: commands, plugins, preferences`,
  );
}

export function normalizeListCliResource(resource?: string): ListCliResource | undefined {
  if (resource === undefined || resource === "command" || resource === "commands") {
    return "commands";
  }

  if (resource === "plugin" || resource === "plugins") {
    return "plugins";
  }

  if (resource === "preference" || resource === "preferences") {
    return "preferences";
  }

  return undefined;
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

function syncScannedPluginIndex(options: {
  manifestIndex: ManifestIndex;
  plugins: PluginRepository;
}): void {
  options.plugins.syncScannedPlugins({
    plugins: options.manifestIndex.listPlugins().map((plugin) => ({
      manifest: plugin.manifest,
      manifestPath: plugin.manifestPath,
    })),
  });
}

function assertCommandPluginEnabled(options: {
  commandId: string;
  pluginId?: string;
  plugins: PluginRepository;
}): void {
  if (!options.pluginId) {
    return;
  }

  const plugin = options.plugins.getById(options.pluginId);

  if (!plugin?.enabled) {
    throw new Error(`Plugin is disabled for command ${options.commandId}: ${options.pluginId}`);
  }
}

function assertPluginsAvailable(
  created: CreatedPluginManager,
  pluginSources: PluginScanSource[],
): void {
  if (created.pluginCount === 0) {
    throw new Error(
      `No plugins found in plugin sources: ${formatPluginSourcePaths(pluginSources)}`,
    );
  }

  if (created.commandCount === 0) {
    throw new Error(
      `No commands found in plugin sources: ${formatPluginSourcePaths(pluginSources)}`,
    );
  }
}

function resolvePluginSources(options: {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
}): PluginScanSource[] {
  if (options.pluginSources) {
    return options.pluginSources;
  }

  if (!options.pluginsRoot) {
    throw new Error("Missing plugin scan sources.");
  }

  return [
    {
      kind: "builtin",
      path: options.pluginsRoot,
    },
  ];
}

function formatPluginSourcePaths(pluginSources: PluginScanSource[]): string {
  return pluginSources.map((source) => source.path).join(", ");
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function formatPropertiesBlock(block: PropertiesContentBlock): string {
  return block.items
    .map((item) => {
      const note = item.note ? ` (${resolveLocalizedString(item.note)})` : "";

      return `${resolveLocalizedString(item.label)}: ${formatPropertyValue(item.value)}${note}`;
    })
    .join("\n");
}

function formatPropertyValue(value: PropertyValue): string {
  return value === null ? "null" : String(value);
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function getCommandHistoryEnabled(preferences: PreferenceRepository): boolean {
  const value = preferences.get("cli", "command.history.enabled");

  if (value === undefined) {
    return true;
  }

  return validatePreferenceValue("cli", "command.history.enabled", value) as boolean;
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
