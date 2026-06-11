import path from "node:path";

import { resolveTooldeckPaths, type TooldeckPaths, type TooldeckRuntimeMode } from "@tooldeck/core";

export interface CreateCliCommandOptions {
  workspaceRoot: string;
}

export interface ResolveCliRuntimePathsOptions {
  workspaceRoot: string;
  mode?: TooldeckRuntimeMode;
  plugins?: string;
  storage?: string;
}

export interface CliRuntimePaths {
  tooldeckPaths: TooldeckPaths;
  pluginsRoot: string;
  storagePath: string;
}

export function resolveCliRuntimePaths(options: ResolveCliRuntimePathsOptions): CliRuntimePaths {
  const tooldeckPaths = resolveTooldeckPaths({
    mode: options.mode ?? "development",
    workspaceRoot: options.workspaceRoot,
  });

  return {
    tooldeckPaths,
    pluginsRoot:
      resolveCliPathOverride(options.workspaceRoot, options.plugins) ??
      tooldeckPaths.builtinPluginsDir,
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

export function requireCliArgument(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

function resolveCliPathOverride(workspaceRoot: string, value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}
