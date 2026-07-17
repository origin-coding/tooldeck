import { defineCommand } from "citty";

import {
  normalizeListCliResource,
  printCommandList,
  printCommandResult,
  printUnsupportedListResource,
} from "./command-output";
import { listCliCommands, runCliCommandWithStorage } from "./command-runtime";
import { listCliPlugins, printPluginList } from "./plugins";
import { getCliOutputFormat, listCliPreferences, printPreferenceList } from "./preferences";
import {
  createPluginDirCommandArg,
  createPluginsCommandArg,
  createStorageCommandArg,
  resolveCliPluginDirOption,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

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

      printCommandResult(result, outputFormat);
    },
  });
}
