import path from "node:path";

import type { PluginScanSource } from "@tooldeck/runtime-node";

import {
  type CommandInputPreprocessor,
  identityCommandInputPreprocessor,
} from "@/application/adapters";
import type {
  ApplicationCommandInputCoercion,
  ApplicationPluginSource,
  CreateTooldeckApplicationOptions,
} from "@/application/types";
import { ApplicationError } from "@/errors/error";
import { resolveTooldeckPaths, type TooldeckPaths } from "@/paths";

export interface ApplicationConfiguration {
  readonly paths: TooldeckPaths;
  readonly pluginSources: PluginScanSource[];
  readonly commandInputCoercion: ApplicationCommandInputCoercion;
  readonly preprocessCommandInput: CommandInputPreprocessor;
}

export function normalizeApplicationConfiguration(
  options: CreateTooldeckApplicationOptions = {},
): ApplicationConfiguration {
  if (options.paths && options.pathOptions) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Application paths and pathOptions cannot both be provided.",
    });
  }

  const paths = options.paths ?? resolveTooldeckPaths(options.pathOptions);

  return {
    paths,
    pluginSources: normalizePluginSources(options.pluginSources, paths),
    commandInputCoercion: options.commandInputCoercion ?? "none",
    preprocessCommandInput:
      options.adapters?.commands?.preprocessInput ?? identityCommandInputPreprocessor,
  };
}

function normalizePluginSources(
  configuredSources: readonly ApplicationPluginSource[] | undefined,
  paths: TooldeckPaths,
): PluginScanSource[] {
  const sources = configuredSources ?? [
    { kind: "builtin", path: paths.builtinPluginsDir },
    { kind: "installed", path: paths.installedPluginsDir },
    { kind: "external", path: paths.userPluginsDir },
  ];
  const installedSources = sources.filter((source) => source.kind === "installed");

  if (installedSources.length > 1) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Application plugin sources may contain at most one installed source.",
    });
  }

  const installedSource = installedSources[0];

  if (
    installedSource &&
    path.resolve(installedSource.path) !== path.resolve(paths.installedPluginsDir)
  ) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Installed plugin source does not match the application installed plugins path.",
    });
  }

  return [
    ...sources.filter((source) => source.kind === "builtin"),
    installedSource ?? { kind: "installed", path: paths.installedPluginsDir },
    ...sources.filter((source) => source.kind === "external"),
  ];
}
