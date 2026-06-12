import type { TooldeckPaths } from "@tooldeck/core";
import { defineCommand } from "citty";
import { consola } from "consola";

import {
  createPluginsCommandArg,
  createStorageCommandArg,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

export function definePathsCommand(options: CreateCliCommandOptions) {
  return defineCommand({
    meta: {
      name: "paths",
      description: "Print resolved Tooldeck paths.",
    },
    args: {
      plugins: {
        ...createPluginsCommandArg(),
        description: "Plugin directory override to show.",
      },
      storage: createStorageCommandArg("SQLite database path override to show."),
    },
    run({ args }) {
      const { tooldeckPaths, pluginsRoot, storagePath } = resolveCliRuntimePaths({
        ...options,
        plugins: args.plugins,
        storage: args.storage,
      });

      printTooldeckPaths({
        ...tooldeckPaths,
        builtinPluginsDir: pluginsRoot,
        databasePath: storagePath,
      });
    },
  });
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
