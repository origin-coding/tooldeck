import type { PluginScanSource } from "@tooldeck/runtime-node";

import type {
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
  TooldeckDatabase,
} from "@/storage";

export interface PluginManagementContext {
  database: TooldeckDatabase;
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  installs: PluginInstallRepository;
  kv: PluginKvRepository;
  plugins: PluginRepository;
  states: PluginStateRepository;
}
