export {
  scanAndSyncPluginCatalog,
  setManagedPluginEnabled,
  syncPluginCatalog,
  syncPluginRepository,
} from "@/plugins/management/catalog";
export { makePluginManagementContext } from "@/plugins/management/context";
export type {
  PluginManagementContext,
  PluginManagementOptions,
} from "@/plugins/management/context";
export { installPluginPackage } from "@/plugins/management/install";
export {
  assertExpectedInstalledPluginDir,
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolveInstalledPluginDir,
  resolvePluginManagementStagingDir,
} from "@/plugins/management/paths";
export { listPurgeablePluginData, purgePluginData } from "@/plugins/management/purge";
export type {
  InstalledPluginSummary,
  PluginCatalogSnapshot,
  PurgeablePluginDataSummary,
  PurgedPluginSummary,
  UninstalledPluginSummary,
} from "@/plugins/management/types";
export { uninstallPlugin } from "@/plugins/management/uninstall";
