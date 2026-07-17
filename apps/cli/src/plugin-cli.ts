import { TooldeckError } from "@tooldeck/shared";
import { defineCommand } from "citty";

import {
  installCliPlugin,
  listCliPlugins,
  purgeCliPlugin,
  setCliPluginEnabled,
  uninstallCliPlugin,
} from "./plugin-operations";
import {
  printPluginInstall,
  printPluginList,
  printPluginPurge,
  printPluginUninstall,
} from "./plugin-output";
import { getCliOutputFormat } from "./preferences";
import {
  createPluginDirCommandArg,
  createPluginsCommandArg,
  createStorageCommandArg,
  requireCliArgument,
  resolveCliPluginDirOption,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

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
