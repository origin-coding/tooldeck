import type { ManifestIndex, PluginScanSource } from "@tooldeck/runtime-node";

import type { ApplicationCleanupFailureDiagnostic } from "@/errors/application-cleanup";
import type { ApplicationRepositories, ApplicationStorageService } from "@/storage/context";
import type { PluginInstallRow, PluginRow } from "@/storage/repositories";

export interface PluginManagementServiceOptions {
  installedPluginsDir: string;
  pluginSources: PluginScanSource[];
  repositories: Pick<
    ApplicationRepositories,
    "pluginInstalls" | "pluginKv" | "plugins" | "pluginStates"
  >;
  withImmediateTransaction: ApplicationStorageService["withImmediateTransaction"];
}

export interface PluginCatalogSnapshot {
  manifestIndex: ManifestIndex;
  plugins: PluginRow[];
}

export interface InstalledPluginSummary {
  install: PluginInstallRow;
  plugin: PluginRow;
}

export interface UninstalledPluginSummary {
  cleanupFailures: ApplicationCleanupFailureDiagnostic[];
  cleanupPending: boolean;
  filesMissing: boolean;
  install: PluginInstallRow;
  pluginId: string;
}

export interface PurgedPluginSummary {
  kvEntriesRemoved: number;
  pluginId: string;
  stateRemoved: boolean;
}

export interface PurgeablePluginDataSummary {
  kvEntries: number;
  pluginId: string;
  statePresent: boolean;
}
