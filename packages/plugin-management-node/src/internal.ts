import type { PluginScanSource } from "@tooldeck/runtime-node";
import type { PluginInstallRepository, PluginRepository } from "@tooldeck/storage";

export interface PluginManagementContext {
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  installs: PluginInstallRepository;
  plugins: PluginRepository;
}
