import path from "node:path";

import type { PluginScanSource } from "@tooldeck/runtime-node";

import { ApplicationError } from "@/errors/error";
import type { ApplicationRepositories, ApplicationStorageService } from "@/storage/context";
import type {
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
} from "@/storage/repositories";

export interface PluginManagementOptions {
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  repositories: Pick<
    ApplicationRepositories,
    "pluginInstalls" | "pluginKv" | "plugins" | "pluginStates"
  >;
  withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"];
}

export interface PluginManagementContext {
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  installs: PluginInstallRepository;
  kv: PluginKvRepository;
  plugins: PluginRepository;
  states: PluginStateRepository;
  withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"];
}

export function makePluginManagementContext(
  options: PluginManagementOptions,
): PluginManagementContext {
  const installedPluginsDir = path.resolve(options.installedPluginsDir);
  const installedSources = options.pluginSources.filter((source) => source.kind === "installed");

  if (
    installedSources.length !== 1 ||
    path.resolve(installedSources[0]!.path) !== installedPluginsDir
  ) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "Plugin management requires exactly one matching installed scan source.",
      details: {
        installedPluginsDir,
        installedSourcePaths: installedSources.map((source) => path.resolve(source.path)),
      },
    });
  }

  return {
    installedPluginsDir,
    pluginSources: options.pluginSources,
    installs: options.repositories.pluginInstalls,
    kv: options.repositories.pluginKv,
    plugins: options.repositories.plugins,
    states: options.repositories.pluginStates,
    withImmediateTransaction: options.withImmediateTransaction,
  };
}
