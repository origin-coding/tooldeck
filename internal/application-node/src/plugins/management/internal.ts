import type { PluginScanSource } from "@tooldeck/runtime-node";

import type { ApplicationStorageService } from "@/storage/context";
import type {
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
} from "@/storage/repositories";

export interface PluginManagementContext {
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  installs: PluginInstallRepository;
  kv: PluginKvRepository;
  plugins: PluginRepository;
  states: PluginStateRepository;
  withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"];
}
