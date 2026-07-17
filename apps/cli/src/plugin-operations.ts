import path from "node:path";

import type { LocalizedString } from "@tooldeck/protocol";
import type { PluginScanSource } from "@tooldeck/runtime-node";
import type { PluginRow } from "@tooldeck/storage";

import { withCliPluginManagement } from "./plugin-management";

export interface ListCliPluginsOptions {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface SetCliPluginEnabledOptions {
  pluginId: string;
  enabled: boolean;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface InstallCliPluginOptions {
  packagePath: string;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}

export interface UninstallCliPluginOptions {
  pluginId: string;
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
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
  cleanupError?: string;
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

export async function listCliPlugins(options: ListCliPluginsOptions): Promise<ListedCliPlugin[]> {
  return withCliPluginManagement(
    {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    },
    async ({ management }) => {
      const catalog = await management.scanAndSyncCatalog();

      return catalog.plugins.map(formatListedPlugin);
    },
  );
}

export async function setCliPluginEnabled(
  options: SetCliPluginEnabledOptions,
): Promise<ListedCliPlugin> {
  return withCliPluginManagement(
    {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    },
    async ({ management }) => {
      const plugin = await management.setEnabled(options.pluginId, options.enabled);

      return formatListedPlugin(plugin);
    },
  );
}

export async function installCliPlugin(
  options: InstallCliPluginOptions,
): Promise<InstalledCliPlugin> {
  return withCliPluginManagement(
    {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    },
    async ({ management }) => {
      const installed = await management.installPackage(options.packagePath);

      return {
        ...formatListedPlugin(installed.plugin),
        installDir: installed.install.installDir,
        packageDigest: installed.install.packageDigest,
        packageName: installed.install.packageName,
        packageSizeBytes: installed.install.packageSizeBytes,
      };
    },
  );
}

export async function uninstallCliPlugin(
  options: UninstallCliPluginOptions,
): Promise<UninstalledCliPlugin> {
  return withCliPluginManagement(
    {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    },
    async ({ management }) => {
      const uninstalled = await management.uninstall(options.pluginId);

      return {
        ...(uninstalled.cleanupError ? { cleanupError: uninstalled.cleanupError } : {}),
        cleanupPending: uninstalled.cleanupPending,
        filesMissing: uninstalled.filesMissing,
        id: uninstalled.pluginId,
        installDir: uninstalled.install.installDir,
        version: uninstalled.install.version,
      };
    },
  );
}

export async function purgeCliPlugin(options: PurgeCliPluginOptions): Promise<PurgedCliPlugin> {
  return withCliPluginManagement(
    {
      pluginSources: resolvePluginSources(options),
      storagePath: options.storagePath,
    },
    ({ management }) => {
      const purged = management.purge(options.pluginId);

      return {
        id: purged.pluginId,
        kvEntriesRemoved: purged.kvEntriesRemoved,
        stateRemoved: purged.stateRemoved,
      };
    },
  );
}

function formatListedPlugin(plugin: PluginRow): ListedCliPlugin {
  return {
    id: plugin.id,
    enabled: plugin.enabled,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    name: resolveStoredLocalizedString(plugin.nameJson),
    sourceKind: plugin.sourceKind,
  };
}

function resolvePluginSources(options: {
  pluginsRoot?: string;
  pluginSources?: PluginScanSource[];
  storagePath: string;
}): PluginScanSource[] {
  if (options.pluginSources) {
    return options.pluginSources;
  }

  if (!options.pluginsRoot) {
    throw new Error("Missing plugin scan sources.");
  }

  return [
    {
      kind: "builtin",
      path: options.pluginsRoot,
    },
    {
      kind: "installed",
      path: path.join(path.dirname(options.storagePath), "installed-plugins"),
    },
  ];
}

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function resolveStoredLocalizedString(value: string): string {
  try {
    return resolveLocalizedString(JSON.parse(value) as LocalizedString);
  } catch {
    return value;
  }
}
