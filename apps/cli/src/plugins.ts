import path from "node:path";

import { PluginManagementService } from "@tooldeck/plugin-management-node";
import type { LocalizedString } from "@tooldeck/protocol";
import type { PluginScanSource } from "@tooldeck/runtime-node";
import type { PluginRow } from "@tooldeck/storage";
import { withTooldeckDatabase } from "@tooldeck/storage";
import { defineCommand } from "citty";
import { consola } from "consola";

import { formatPluginList } from "./output";
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

export interface ListedCliPlugin {
  id: string;
  enabled: boolean;
  version: string;
  manifestPath: string;
  name: string;
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

export function definePluginCommand(options: CreateCliCommandOptions) {
  return defineCommand({
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

function formatListedPlugin(plugin: PluginRow): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveStoredLocalizedString(plugin.nameJson),
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
