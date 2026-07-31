import path from "node:path";

import {
  withTooldeckApplication,
  type ApplicationPluginSource,
  type CreateTooldeckApplicationOptions,
  type TooldeckApplication,
} from "@tooldeck/application-node";

export interface CliApplicationOptions {
  pluginSources?: ApplicationPluginSource[];
  pluginsRoot?: string;
  storagePath: string;
}

export function withCliApplication<TResult>(
  options: CliApplicationOptions,
  callback: (application: TooldeckApplication) => TResult | Promise<TResult>,
  applicationOptions: Pick<
    CreateTooldeckApplicationOptions,
    "adapters" | "commandInputCoercion"
  > = {},
): Promise<TResult> {
  const pluginSources =
    options.pluginSources ??
    (options.pluginsRoot ? [{ kind: "builtin" as const, path: options.pluginsRoot }] : []);
  const dataDir = path.dirname(options.storagePath);
  const builtinPluginsDir =
    pluginSources.find((source) => source.kind === "builtin")?.path ??
    path.join(dataDir, "builtin-plugins");
  const installedPluginsDir =
    pluginSources.find((source) => source.kind === "installed")?.path ??
    path.join(dataDir, "installed-plugins");

  return withTooldeckApplication(
    {
      ...applicationOptions,
      pathOptions: {
        mode: "development",
        workspaceRoot: path.dirname(builtinPluginsDir),
        overrides: {
          builtinPluginsDir,
          databasePath: options.storagePath,
          installedPluginsDir,
          pluginDataDir: path.join(dataDir, "plugin-data"),
          userDataDir: dataDir,
          userPluginsDir: path.join(dataDir, "plugins"),
        },
      },
      pluginSources,
    },
    callback,
  );
}
