import path from "node:path";

import {
  resolveTooldeckPaths,
  type PluginScanSource,
  type TooldeckPaths,
  type TooldeckRuntimeMode,
} from "@tooldeck/runtime-node";

export interface CreateCliCommandOptions {
  appInstallDir?: string;
  builtinPluginsDir?: string;
  installedPluginsDir?: string;
  mode?: TooldeckRuntimeMode;
  workspaceRoot: string;
}

export interface ResolveCliRuntimePathsOptions {
  appInstallDir?: string;
  builtinPluginsDir?: string;
  installedPluginsDir?: string;
  mode?: TooldeckRuntimeMode;
  workspaceRoot: string;
  plugins?: string;
  pluginDir?: string | string[];
  storage?: string;
}

export interface CliRuntimePaths {
  tooldeckPaths: TooldeckPaths;
  pluginsRoot: string;
  pluginSources: PluginScanSource[];
  storagePath: string;
}

export function resolveCliRuntimePaths(options: ResolveCliRuntimePathsOptions): CliRuntimePaths {
  const tooldeckPaths = resolveTooldeckPaths({
    appInstallDir: options.appInstallDir,
    mode: options.mode ?? "development",
    overrides: {
      builtinPluginsDir: options.builtinPluginsDir,
      installedPluginsDir: options.installedPluginsDir,
    },
    workspaceRoot: options.workspaceRoot,
  });

  const pluginsRoot =
    resolveCliPathOverride(options.workspaceRoot, options.plugins) ??
    tooldeckPaths.builtinPluginsDir;
  const pluginDirs = resolveCliPathOverrides(options.workspaceRoot, options.pluginDir);

  return {
    tooldeckPaths,
    pluginsRoot,
    pluginSources: [
      {
        kind: "builtin",
        path: pluginsRoot,
      },
      {
        kind: "installed",
        path: tooldeckPaths.installedPluginsDir,
      },
      ...pluginDirs.map((pluginDir) => ({
        kind: "external" as const,
        path: pluginDir,
      })),
    ],
    storagePath:
      resolveCliPathOverride(options.workspaceRoot, options.storage) ?? tooldeckPaths.databasePath,
  };
}

export function createStorageCommandArg(description: string) {
  return {
    type: "string" as const,
    description,
    valueHint: "path",
  };
}

export function createPluginsCommandArg() {
  return {
    type: "string" as const,
    description: "Plugin directory to scan. Defaults to the resolved builtin plugin path.",
    valueHint: "path",
  };
}

export function createPluginDirCommandArg() {
  return {
    type: "string" as const,
    description: "Additional trusted local plugin project or collection directory to scan.",
    valueHint: "path",
  };
}

export function resolveCliPluginDirOption(options: {
  rawArgs?: string[];
  value?: string | string[];
}): string | string[] | undefined {
  const parsed = parseCliPluginDirArgs(options.rawArgs ?? []);

  return parsed.length > 0 ? parsed : options.value;
}

export function parseCliPluginDirArgs(rawArgs: string[]): string[] {
  const pluginDirs: string[] = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--plugin-dir" || arg === "--pluginDir") {
      const value = rawArgs[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --plugin-dir.");
      }

      pluginDirs.push(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--plugin-dir=")) {
      const value = arg.slice("--plugin-dir=".length);

      if (!value) {
        throw new Error("Missing value for --plugin-dir.");
      }

      pluginDirs.push(value);
      continue;
    }

    if (arg.startsWith("--pluginDir=")) {
      const value = arg.slice("--pluginDir=".length);

      if (!value) {
        throw new Error("Missing value for --plugin-dir.");
      }

      pluginDirs.push(value);
    }
  }

  return pluginDirs;
}

export function requireCliArgument(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

export function ensureCliInstalledPluginSource(
  pluginSources: PluginScanSource[],
  storagePath: string,
): PluginScanSource[] {
  const installedSources = pluginSources.filter((source) => source.kind === "installed");

  return [
    ...pluginSources.filter((source) => source.kind === "builtin"),
    ...(installedSources.length > 0
      ? installedSources
      : [
          {
            kind: "installed" as const,
            path: path.join(path.dirname(storagePath), "installed-plugins"),
          },
        ]),
    ...pluginSources.filter((source) => source.kind === "external"),
  ];
}

export function resolveCliInstalledPluginsDir(pluginSources: PluginScanSource[]): string {
  const installedSource = pluginSources.find((source) => source.kind === "installed");

  if (!installedSource) {
    throw new Error("Missing installed plugin scan source.");
  }

  return installedSource.path;
}

function resolveCliPathOverride(workspaceRoot: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

function resolveCliPathOverrides(workspaceRoot: string, value?: string | string[]): string[] {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.map((entry) =>
    path.isAbsolute(entry) ? entry : path.resolve(workspaceRoot, entry),
  );
}
