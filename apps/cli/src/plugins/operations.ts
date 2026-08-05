import path from "node:path";

import type {
  ApplicationCleanupFailureDiagnostic,
  ApplicationInstalledPlugin,
  ApplicationPlugin,
  ApplicationPluginSource,
} from "@tooldeck/application-node";
import type { LocalizedString } from "@tooldeck/protocol";

import { withCliApplication } from "../application";

export interface ListCliPluginsOptions {
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath: string;
}

export interface SetCliPluginEnabledOptions {
  pluginId: string;
  enabled: boolean;
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath: string;
}

export interface InstallCliPluginOptions {
  packagePath: string;
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath: string;
}

export interface UninstallCliPluginOptions {
  pluginId: string;
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath: string;
}

export type PurgeCliPluginOptions = UninstallCliPluginOptions;

export interface ListedCliPlugin {
  id: string;
  enabled: boolean;
  version: string;
  manifestPath: string;
  name: string;
  sourceKind: string;
}

export interface InstalledCliPlugin extends ListedCliPlugin {
  installDir: string;
  packageDigest: string;
  packageName: string;
  packageSizeBytes: number;
}

export interface UninstalledCliPlugin {
  cleanupFailures: ApplicationCleanupFailureDiagnostic[];
  cleanupPending: boolean;
  filesMissing: boolean;
  id: string;
  installDir: string;
  version: string;
}

export interface PurgedCliPlugin {
  id: string;
  kvEntriesRemoved: number;
  stateRemoved: boolean;
}

export function listCliPlugins(options: ListCliPluginsOptions): Promise<ListedCliPlugin[]> {
  return withCliApplication(options, async (application) =>
    (await application.plugins.list()).map(formatListedPlugin),
  );
}

export function setCliPluginEnabled(options: SetCliPluginEnabledOptions): Promise<ListedCliPlugin> {
  return withCliApplication(options, async (application) =>
    formatListedPlugin(await application.plugins.setEnabled(options.pluginId, options.enabled)),
  );
}

export function installCliPlugin(options: InstallCliPluginOptions): Promise<InstalledCliPlugin> {
  return withCliApplication(options, async (application) => {
    const installed = await application.plugins.installPackage(path.resolve(options.packagePath));

    return {
      ...formatInstalledPlugin(installed.plugin),
      installDir: installed.install.installDir,
      packageDigest: installed.install.packageDigest,
      packageName: installed.install.packageName,
      packageSizeBytes: installed.install.packageSizeBytes,
    };
  });
}

export function uninstallCliPlugin(
  options: UninstallCliPluginOptions,
): Promise<UninstalledCliPlugin> {
  return withCliApplication(options, async (application) => {
    const uninstalled = await application.plugins.uninstall(options.pluginId);

    return {
      cleanupFailures: uninstalled.cleanupFailures,
      cleanupPending: uninstalled.cleanupPending,
      filesMissing: uninstalled.filesMissing,
      id: uninstalled.pluginId,
      installDir: uninstalled.install.installDir,
      version: uninstalled.install.version,
    };
  });
}

export function purgeCliPlugin(options: PurgeCliPluginOptions): Promise<PurgedCliPlugin> {
  return withCliApplication(options, async (application) => {
    const purged = await application.plugins.purgeData(options.pluginId);

    return {
      id: purged.pluginId,
      kvEntriesRemoved: purged.kvEntriesRemoved,
      stateRemoved: purged.stateRemoved,
    };
  });
}

function formatListedPlugin(plugin: ApplicationPlugin): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveLocalizedString(plugin.name),
    sourceKind: plugin.sourceKind,
  };
}

function formatInstalledPlugin(plugin: ApplicationInstalledPlugin): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveLocalizedString(plugin.name),
    sourceKind: plugin.sourceKind,
  };
}

function resolveLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}
