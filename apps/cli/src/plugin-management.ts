import { PluginManagementService } from "@tooldeck/plugin-management-node";
import type { PluginScanSource } from "@tooldeck/runtime-node";
import { type TooldeckDatabase, withTooldeckDatabase } from "@tooldeck/storage";

import { ensureCliInstalledPluginSource, resolveCliInstalledPluginsDir } from "./runtime";

export interface CliPluginManagementOptions {
  pluginSources: PluginScanSource[];
  storagePath: string;
}

export interface CliPluginManagementContext {
  management: PluginManagementService;
  pluginSources: PluginScanSource[];
}

export function createCliPluginManagement(
  database: TooldeckDatabase,
  options: CliPluginManagementOptions,
): CliPluginManagementContext {
  const pluginSources = ensureCliInstalledPluginSource(options.pluginSources, options.storagePath);

  return {
    management: new PluginManagementService({
      database,
      installedPluginsDir: resolveCliInstalledPluginsDir(pluginSources),
      pluginSources,
    }),
    pluginSources,
  };
}

export function withCliPluginManagement<TResult>(
  options: CliPluginManagementOptions,
  callback: (context: CliPluginManagementContext) => TResult | Promise<TResult>,
): Promise<TResult> {
  return withTooldeckDatabase({ path: options.storagePath }, (database) =>
    callback(createCliPluginManagement(database, options)),
  );
}
