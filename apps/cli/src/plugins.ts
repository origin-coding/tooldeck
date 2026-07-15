import path from "node:path";

import { PluginManagementService } from "@tooldeck/plugin-management-node";
import type { LocalizedString } from "@tooldeck/protocol";
import type { PluginScanSource } from "@tooldeck/runtime-node";
import { TooldeckError } from "@tooldeck/shared";
import type { PluginRow } from "@tooldeck/storage";
import { withTooldeckDatabase } from "@tooldeck/storage";
import { defineCommand } from "citty";
import { consola } from "consola";

import {
  formatPluginInstall,
  formatPluginList,
  formatPluginPurge,
  formatPluginUninstall,
} from "./output";
import { getCliOutputFormat, type CliOutputFormat } from "./preferences";
import {
  createPluginDirCommandArg,
  createPluginsCommandArg,
  createStorageCommandArg,
  ensureCliInstalledPluginSource,
  requireCliArgument,
  resolveCliInstalledPluginsDir,
  resolveCliPluginDirOption,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

export interface ListCliPluginsOptions {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface SetCliPluginEnabledOptions {
  pluginId: string;
  enabled: boolean;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface InstallCliPluginOptions {
  packagePath: string;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface UninstallCliPluginOptions {
  pluginId: string;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export type PurgeCliPluginOptions = UninstallCliPluginOptions;

export interface ListedCliPlugin {
  id: string;
  enabled: boolean;
  version: string;
  manifestPath: string;
  name: string;
  sourceKind: string;
}

export interface InstalledCliPlugin extends ListedCliPlugin {
  installDir: string;
  packageDigest: string;
  packageName: string;
  packageSizeBytes: number;
}

export interface UninstalledCliPlugin {
  cleanupError?: string;
  cleanupPending: boolean;
  filesMissing: boolean;
  id: string;
  installDir: string;
  version: string;
}

export interface PurgedCliPlugin {
  id: string;
  kvEntriesRemoved: number;
  stateRemoved: boolean;
}

export async function listCliPlugins(options: ListCliPluginsOptions): Promise<ListedCliPlugin[]> {
  return withTooldeckDatabase({ path: options.storagePath }, async (database) => {
    const pluginSources = ensureCliInstalledPluginSource(
      resolvePluginSources(options),
      options.storagePath,
    );
    const management = new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    });
    const catalog = await management.scanAndSyncCatalog();

    return catalog.plugins.map(formatListedPlugin);
  });
}

export async function setCliPluginEnabled(
  options: SetCliPluginEnabledOptions,
): Promise<ListedCliPlugin> {
  return withTooldeckDatabase({ path: options.storagePath }, async (database) => {
    const pluginSources = ensureCliInstalledPluginSource(
      resolvePluginSources(options),
      options.storagePath,
    );
    const management = new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    });
    const plugin = await management.setEnabled(options.pluginId, options.enabled);

    return formatListedPlugin(plugin);
  });
}

export async function installCliPlugin(
  options: InstallCliPluginOptions,
): Promise<InstalledCliPlugin> {
  return withTooldeckDatabase({ path: options.storagePath }, async (database) => {
    const pluginSources = ensureCliInstalledPluginSource(
      resolvePluginSources(options),
      options.storagePath,
    );
    const management = new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    });
    const installed = await management.installPackage(options.packagePath);

    return {
      ...formatListedPlugin(installed.plugin),
      installDir: installed.install.installDir,
      packageDigest: installed.install.packageDigest,
      packageName: installed.install.packageName,
      packageSizeBytes: installed.install.packageSizeBytes,
    };
  });
}

export async function uninstallCliPlugin(
  options: UninstallCliPluginOptions,
): Promise<UninstalledCliPlugin> {
  return withTooldeckDatabase({ path: options.storagePath }, async (database) => {
    const pluginSources = ensureCliInstalledPluginSource(
      resolvePluginSources(options),
      options.storagePath,
    );
    const management = new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    });
    const uninstalled = await management.uninstall(options.pluginId);

    return {
      ...(uninstalled.cleanupError ? { cleanupError: uninstalled.cleanupError } : {}),
      cleanupPending: uninstalled.cleanupPending,
      filesMissing: uninstalled.filesMissing,
      id: uninstalled.pluginId,
      installDir: uninstalled.install.installDir,
      version: uninstalled.install.version,
    };
  });
}

export async function purgeCliPlugin(options: PurgeCliPluginOptions): Promise<PurgedCliPlugin> {
  return withTooldeckDatabase({ path: options.storagePath }, (database) => {
    const pluginSources = ensureCliInstalledPluginSource(
      resolvePluginSources(options),
      options.storagePath,
    );
    const management = new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    });
    const purged = management.purge(options.pluginId);

    return {
      id: purged.pluginId,
      kvEntriesRemoved: purged.kvEntriesRemoved,
      stateRemoved: purged.stateRemoved,
    };
  });
}

export function definePluginCommand(options: CreateCliCommandOptions) {
  return defineCommand({
    meta: {
      name: "plugin",
      description: "Manage Tooldeck plugins.",
    },
    subCommands: {
      install: defineCommand({
        meta: {
          name: "install",
          description: "Install a local .tdplugin package.",
        },
        args: createPluginInstallCommandArgs(),
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
          const plugin = await installCliPlugin({
            packagePath: requireCliArgument(args.packagePath, "packagePath"),
            pluginSources,
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPluginInstall(plugin, outputFormat);
        },
      }),
      uninstall: defineCommand({
        meta: {
          name: "uninstall",
          description: "Uninstall a managed local plugin.",
        },
        args: createPluginEnabledCommandArgs(),
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
          const plugin = await uninstallCliPlugin({
            pluginId: requireCliArgument(args.pluginId, "pluginId"),
            pluginSources,
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPluginUninstall(plugin, outputFormat);
        },
      }),
      purge: defineCommand({
        meta: {
          name: "purge",
          description: "Purge retained local data for an uninstalled plugin.",
        },
        args: createPluginEnabledCommandArgs(),
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
          const pluginId = requireCliArgument(args.pluginId, "pluginId");

          try {
            const plugin = await purgeCliPlugin({
              pluginId,
              pluginSources,
              storagePath,
            });
            const outputFormat = await getCliOutputFormat({ storagePath });

            printPluginPurge(plugin, outputFormat);
          } catch (error) {
            if (error instanceof TooldeckError && error.code === "ERR_ALREADY_EXISTS") {
              throw new Error(
                `${error.message}. Run "tooldeck plugin uninstall ${pluginId}" first.`,
                { cause: error },
              );
            }

            throw error;
          }
        },
      }),
      list: defineCommand({
        meta: {
          name: "list",
          description: "List registered plugins.",
        },
        args: createPluginRuntimeCommandArgs("SQLite database path for plugin registry."),
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
          const plugins = await listCliPlugins({
            pluginSources,
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPluginList(plugins, outputFormat);
        },
      }),
      enable: defineCommand({
        meta: {
          name: "enable",
          description: "Enable a Tooldeck plugin.",
        },
        args: createPluginEnabledCommandArgs(),
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
          const plugin = await setCliPluginEnabled({
            pluginId: requireCliArgument(args.pluginId, "pluginId"),
            enabled: true,
            pluginSources,
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPluginList([plugin], outputFormat);
        },
      }),
      disable: defineCommand({
        meta: {
          name: "disable",
          description: "Disable a Tooldeck plugin.",
        },
        args: createPluginEnabledCommandArgs(),
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
          const plugin = await setCliPluginEnabled({
            pluginId: requireCliArgument(args.pluginId, "pluginId"),
            enabled: false,
            pluginSources,
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPluginList([plugin], outputFormat);
        },
      }),
    },
  });
}

export function printPluginList(
  plugins: ListedCliPlugin[],
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugins, null, 2));
    return;
  }

  consola.log(formatPluginList(plugins));
}

export function printPluginInstall(
  plugin: InstalledCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginInstall(plugin));
}

export function printPluginUninstall(
  plugin: UninstalledCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginUninstall(plugin));
}

export function printPluginPurge(
  plugin: PurgedCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginPurge(plugin));
}

function formatListedPlugin(plugin: PluginRow): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveStoredLocalizedString(plugin.nameJson),
    sourceKind: plugin.sourceKind,
  };
}

function resolvePluginSources(options: {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
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
    {
      kind: "installed",
      path: path.join(path.dirname(options.storagePath), "installed-plugins"),
    },
  ];
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

function createPluginRuntimeCommandArgs(storageDescription: string) {
  return {
    plugins: createPluginsCommandArg(),
    pluginDir: createPluginDirCommandArg(),
    storage: createStorageCommandArg(storageDescription),
  };
}

function createPluginEnabledCommandArgs() {
  return {
    pluginId: {
      type: "positional" as const,
      required: true,
      description: "Plugin id.",
      valueHint: "plugin",
    },
    ...createPluginRuntimeCommandArgs("SQLite database path for plugin registry."),
  };
}

function createPluginInstallCommandArgs() {
  return {
    packagePath: {
      type: "positional" as const,
      required: true,
      description: "Path to a local .tdplugin package.",
      valueHint: "package",
    },
    ...createPluginRuntimeCommandArgs("SQLite database path for plugin registry."),
  };
}
