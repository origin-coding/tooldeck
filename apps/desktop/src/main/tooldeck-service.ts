import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  CommandRegistry,
  CommandService,
  ManifestIndex,
  PluginManager,
  scanPluginDirectory,
  type IndexedCommand,
  type IndexedPlugin,
} from "@tooldeck/core";
import { NodePluginHost } from "@tooldeck/host-node";
import type { CommandResult, LocalizedString } from "@tooldeck/protocol";
import {
  listPreferenceDefinitions,
  requirePreferenceDefinition,
  validatePreferenceValue,
  type PreferenceDefinition,
} from "@tooldeck/shared";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PreferenceRepository,
  type PreferenceRow,
  PluginKvRepository,
  PluginRepository,
  type PluginRow,
  type TooldeckDatabase,
} from "@tooldeck/storage";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPreference,
  DesktopPlugin,
  RunCommandRequest,
  SetPreferenceRequest,
  SetPluginEnabledRequest,
} from "@/shared/desktop-api";

export interface TooldeckDesktopServiceOptions {
  workspaceRoot?: string;
  pluginsRoot?: string;
  storagePath?: string;
}

export class TooldeckDesktopService {
  private readonly workspaceRoot: string;
  private readonly pluginsRoot: string;
  private readonly storagePath: string;
  private database?: TooldeckDatabase;
  private commandRuns?: CommandRunRepository;
  private preferences?: PreferenceRepository;
  private plugins?: PluginRepository;
  private pluginKv?: PluginKvRepository;
  private pluginHost?: NodePluginHost;
  private pluginManager?: PluginManager;
  private commandService?: CommandService;
  private manifestIndex?: ManifestIndex;

  constructor(options: TooldeckDesktopServiceOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
    this.pluginsRoot = options.pluginsRoot ?? path.join(this.workspaceRoot, "plugins");
    this.storagePath =
      options.storagePath ?? path.join(this.workspaceRoot, ".data", "tooldeck.sqlite");
  }

  async start(): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });

    this.database = openTooldeckDatabase({ path: this.storagePath });
    this.commandRuns = new CommandRunRepository(this.database.db);
    this.preferences = new PreferenceRepository(this.database.db);
    this.plugins = new PluginRepository(this.database.db);
    this.pluginKv = new PluginKvRepository(this.database.db);

    await this.scanAndCreateRuntime();
  }

  listCommands(): DesktopCommand[] {
    const plugins = this.requirePlugins();
    const pluginManager = this.requirePluginManager();

    return this.requireManifestIndex()
      .listCommands()
      .map((command) =>
        formatDesktopCommand({
          command,
          plugin: plugins.getById(command.pluginId),
          pluginManager,
        }),
      );
  }

  listPlugins(): DesktopPlugin[] {
    const manifestIndex = this.requireManifestIndex();
    const pluginManager = this.requirePluginManager();

    return this.requirePlugins()
      .list()
      .map((plugin) =>
        formatDesktopPlugin({
          plugin,
          indexedPlugin: manifestIndex.getPlugin(plugin.id),
          commandCount: manifestIndex
            .listCommands()
            .filter((command) => command.pluginId === plugin.id).length,
          pluginManager,
        }),
      );
  }

  listPreferences(): DesktopPreference[] {
    const preferences = this.requirePreferences();

    return listPreferenceDefinitions()
      .filter(isDesktopVisiblePreference)
      .map((definition) =>
        formatDesktopPreference(definition, preferences.getRow(definition.scope, definition.key)),
      );
  }

  setPreference(request: SetPreferenceRequest): DesktopPreference {
    const definition = requirePreferenceDefinition(request.key);

    if (!isDesktopVisiblePreference(definition)) {
      throw new Error(`Desktop cannot manage preference: ${request.key}`);
    }

    const value = validatePreferenceValue(definition.key, request.value);
    const row = this.requirePreferences().set({
      scope: definition.scope,
      key: definition.key,
      value,
    });

    return formatDesktopPreference(definition, row);
  }

  async rescanPlugins(): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }> {
    await this.scanAndCreateRuntime();

    return {
      commands: this.listCommands(),
      plugins: this.listPlugins(),
    };
  }

  async setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin> {
    await this.syncScannedPlugins();

    const plugin = this.requirePlugins().setEnabled(request.pluginId, request.enabled);

    if (!plugin) {
      throw new Error(`Plugin is not registered: ${request.pluginId}`);
    }

    await this.scanAndCreateRuntime();

    const updatedPlugin = this.requirePlugins().getById(request.pluginId);

    if (!updatedPlugin) {
      throw new Error(`Plugin is not registered: ${request.pluginId}`);
    }

    const manifestIndex = this.requireManifestIndex();

    return formatDesktopPlugin({
      plugin: updatedPlugin,
      indexedPlugin: manifestIndex.getPlugin(updatedPlugin.id),
      commandCount: manifestIndex
        .listCommands()
        .filter((command) => command.pluginId === updatedPlugin.id).length,
      pluginManager: this.requirePluginManager(),
    });
  }

  async runCommand(request: RunCommandRequest): Promise<CommandResult> {
    const commandRuns = this.requireCommandRuns();
    const manifestIndex = this.requireManifestIndex();
    const startedAt = performance.now();
    const pluginId = manifestIndex.getCommandOwner(request.commandId);

    try {
      this.assertCommandPluginEnabled(request.commandId, pluginId);

      const run = await this.requireCommandService().runCommand({
        commandId: request.commandId,
        input: request.input,
      });

      commandRuns.create({
        commandId: request.commandId,
        pluginId,
        source: "desktop",
        status: run.result.status,
        input: run.input,
        output: run.result,
        durationMs: elapsedMilliseconds(startedAt),
      });

      return run.result;
    } catch (error) {
      commandRuns.create({
        commandId: request.commandId,
        pluginId,
        source: "desktop",
        status: "error",
        input: request.input,
        error: serializeError(error),
        durationMs: elapsedMilliseconds(startedAt),
      });

      throw error;
    }
  }

  listCommandRuns(limit = 50): CommandRunRecord[] {
    return this.requireCommandRuns()
      .listRecent(limit)
      .map((row) => ({
        id: row.id,
        commandId: row.commandId,
        pluginId: row.pluginId ?? undefined,
        source: row.source,
        status: row.status as CommandResult["status"],
        input: parseJson(row.inputJson),
        output: parseJson(row.outputJson) as CommandResult | undefined,
        error: parseJson(row.errorJson),
        durationMs: row.durationMs ?? undefined,
        createdAt: row.createdAt,
      }));
  }

  async dispose(): Promise<void> {
    try {
      await this.pluginHost?.disposeAll();
    } finally {
      this.database?.close();
    }
  }

  private async scanAndCreateRuntime(): Promise<void> {
    await this.pluginHost?.disposeAll();

    const commandRegistry = new CommandRegistry();
    const manifestIndex = new ManifestIndex();
    const pluginKv = this.requirePluginKv();

    const pluginHost = new NodePluginHost({
      commandRegistry,
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

    await scanPluginDirectory({
      pluginsRoot: this.pluginsRoot,
      manifestIndex,
    });
    this.syncScannedPluginIndex(manifestIndex);

    const pluginManager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    this.pluginHost = pluginHost;
    this.pluginManager = pluginManager;
    this.manifestIndex = manifestIndex;
    this.commandService = new CommandService({
      pluginManager,
      coercion: "none",
    });
  }

  private async syncScannedPlugins(): Promise<ManifestIndex> {
    const manifestIndex = new ManifestIndex();

    await scanPluginDirectory({
      pluginsRoot: this.pluginsRoot,
      manifestIndex,
    });
    this.syncScannedPluginIndex(manifestIndex);

    return manifestIndex;
  }

  private syncScannedPluginIndex(manifestIndex: ManifestIndex): void {
    this.requirePlugins().syncScannedPlugins({
      plugins: manifestIndex.listPlugins().map((plugin) => ({
        manifest: plugin.manifest,
        manifestPath: plugin.manifestPath,
      })),
    });
  }

  private assertCommandPluginEnabled(commandId: string, pluginId: string | undefined): void {
    if (!pluginId) {
      return;
    }

    const plugin = this.requirePlugins().getById(pluginId);

    if (!plugin?.enabled) {
      throw new Error(`Plugin is disabled for command ${commandId}: ${pluginId}`);
    }
  }

  private requireCommandService(): CommandService {
    if (!this.commandService) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandService;
  }

  private requirePluginManager(): PluginManager {
    if (!this.pluginManager) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.pluginManager;
  }

  private requireManifestIndex(): ManifestIndex {
    if (!this.manifestIndex) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.manifestIndex;
  }

  private requireCommandRuns(): CommandRunRepository {
    if (!this.commandRuns) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandRuns;
  }

  private requirePreferences(): PreferenceRepository {
    if (!this.preferences) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.preferences;
  }

  private requirePlugins(): PluginRepository {
    if (!this.plugins) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.plugins;
  }

  private requirePluginKv(): PluginKvRepository {
    if (!this.pluginKv) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.pluginKv;
  }
}

function formatDesktopCommand(options: {
  command: IndexedCommand;
  plugin: PluginRow | undefined;
  pluginManager: PluginManager;
}): DesktopCommand {
  const { command, plugin, pluginManager } = options;

  return {
    id: command.id,
    pluginId: command.pluginId,
    pluginEnabled: plugin?.enabled ?? false,
    pluginRuntimeState: pluginManager.getPluginRuntimeState(command.pluginId),
    title: resolveLocalizedString(command.definition.title),
    description: command.definition.description
      ? resolveLocalizedString(command.definition.description)
      : undefined,
    inputSchema: command.definition.inputSchema,
  };
}

function formatDesktopPlugin(options: {
  plugin: PluginRow;
  indexedPlugin: IndexedPlugin | undefined;
  commandCount: number;
  pluginManager: PluginManager;
}): DesktopPlugin {
  const { plugin, indexedPlugin, commandCount, pluginManager } = options;

  return {
    id: plugin.id,
    name: resolveStoredLocalizedString(plugin.nameJson),
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    enabled: plugin.enabled,
    runtimeState: indexedPlugin ? pluginManager.getPluginRuntimeState(plugin.id) : "inactive",
    commandCount,
    updatedAt: plugin.updatedAt,
  };
}

function formatDesktopPreference(
  definition: PreferenceDefinition,
  preference: PreferenceRow | undefined,
): DesktopPreference {
  return {
    scope: definition.scope,
    key: definition.key,
    value: preference
      ? validatePreferenceValue(definition.key, JSON.parse(preference.valueJson))
      : definition.defaultValue,
    defaultValue: definition.defaultValue,
    description: definition.description,
    valueType: definition.valueType,
    ...(definition.values ? { values: definition.values } : {}),
    ...(preference ? { updatedAt: preference.updatedAt } : {}),
  };
}

function isDesktopVisiblePreference(definition: PreferenceDefinition): boolean {
  return definition.scope === "shared" || definition.scope === "desktop";
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

function parseJson(value: string | null): unknown {
  if (value === null) {
    return undefined;
  }

  return JSON.parse(value);
}

function findWorkspaceRoot(): string {
  let current = process.cwd();

  for (;;) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
