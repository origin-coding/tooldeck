import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  createNodeRuntime,
  type CreateNodeRuntimeOptions,
  type NodePluginHost,
} from "@tooldeck/host-node";
import { validatePreferenceValue } from "@tooldeck/preferences";
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";
import {
  type CommandService,
  type IndexedCommand,
  ManifestIndex,
  parseRawCommandInputFromCliArgs,
  type PluginManager,
  type PluginScanSource,
  scanPluginSources,
} from "@tooldeck/runtime-node";
import type { JsonObject } from "@tooldeck/shared";
import {
  CommandRunRepository,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
  withTooldeckDatabase,
} from "@tooldeck/storage";

import { createCliPluginManagement } from "./plugin-management";
import { serializeError } from "./serialize-error";

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

export interface CreatePluginManagerOptions {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  createPluginStorage?: CreateNodeRuntimeOptions["createPluginStorage"];
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
  const pluginSources = resolvePluginSources(options);
  const runtime = await createNodeRuntime({
    pluginSources,
    coercion: "cli",
    createPluginStorage: options.createPluginStorage,
  });

  return {
    pluginHost: runtime.pluginHost,
    manifestIndex: runtime.manifestIndex,
    pluginCount: runtime.pluginCount,
    commandCount: runtime.commandCount,
    pluginManager: runtime.pluginManager,
    commandService: runtime.commandService,
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
    const { management, pluginSources } = createCliPluginManagement(database, {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    });
    const recordCommandHistory = getCommandHistoryEnabled(preferences);
    const startedAt = performance.now();
    let pluginHost: NodePluginHost | undefined;
    let pluginId: string | undefined;
    let input = options.input;

    try {
      const created = await createPluginManager({
        pluginSources,
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

      assertPluginsAvailable(created, pluginSources);
      management.syncCatalog(created.manifestIndex);
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
  storagePath?: string;
}): PluginScanSource[] {
  if (options.pluginSources) {
    return options.pluginSources;
  }

  if (!options.pluginsRoot) {
    throw new Error("Missing plugin scan sources.");
  }

  const sources: PluginScanSource[] = [
    {
      kind: "builtin",
      path: options.pluginsRoot,
    },
  ];

  if (options.storagePath) {
    sources.push({
      kind: "installed",
      path: path.join(path.dirname(options.storagePath), "installed-plugins"),
    });
  }

  return sources;
}

function formatPluginSourcePaths(pluginSources: PluginScanSource[]): string {
  return pluginSources.map((source) => source.path).join(", ");
}

function resolveLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
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
