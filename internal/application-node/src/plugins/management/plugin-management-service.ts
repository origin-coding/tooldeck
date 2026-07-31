import path from "node:path";

import type { ManifestIndex } from "@tooldeck/runtime-node";

import { ApplicationError } from "@/errors/application-error";
import {
  scanAndSyncPluginCatalog,
  setManagedPluginEnabled,
  syncPluginCatalog,
} from "@/plugins/management/catalog";
import { installPluginPackage } from "@/plugins/management/install";
import type { PluginManagementContext } from "@/plugins/management/internal";
import { listPurgeablePluginData, purgePluginData } from "@/plugins/management/purge";
import type {
  InstalledPluginSummary,
  PluginCatalogSnapshot,
  PluginManagementServiceOptions,
  PurgeablePluginDataSummary,
  PurgedPluginSummary,
  UninstalledPluginSummary,
} from "@/plugins/management/types";
import { uninstallPlugin } from "@/plugins/management/uninstall";
import {
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
  type PluginRow,
} from "@/storage";

export class PluginManagementService {
  private readonly context: PluginManagementContext;

  constructor(options: PluginManagementServiceOptions) {
    const installedPluginsDir = path.resolve(options.installedPluginsDir);

    assertInstalledSourceConfiguration(options.pluginSources, installedPluginsDir);
    this.context = {
      database: options.database,
      installedPluginsDir,
      pluginSources: options.pluginSources,
      installs: new PluginInstallRepository(options.database.db),
      kv: new PluginKvRepository(options.database.db),
      plugins: new PluginRepository(options.database.db),
      states: new PluginStateRepository(options.database.db),
    };
  }

  syncCatalog(manifestIndex: ManifestIndex): PluginRow[] {
    return syncPluginCatalog(this.context, manifestIndex);
  }

  scanAndSyncCatalog(): Promise<PluginCatalogSnapshot> {
    return scanAndSyncPluginCatalog(this.context);
  }

  setEnabled(pluginId: string, enabled: boolean): Promise<PluginRow> {
    return setManagedPluginEnabled(this.context, pluginId, enabled);
  }

  installPackage(packagePath: string): Promise<InstalledPluginSummary> {
    return installPluginPackage(this.context, packagePath);
  }

  uninstall(pluginId: string): Promise<UninstalledPluginSummary> {
    return uninstallPlugin(this.context, pluginId);
  }

  listPurgeablePluginData(): PurgeablePluginDataSummary[] {
    return listPurgeablePluginData(this.context);
  }

  purge(pluginId: string): PurgedPluginSummary {
    return purgePluginData(this.context, pluginId);
  }
}

function assertInstalledSourceConfiguration(
  pluginSources: PluginManagementServiceOptions["pluginSources"],
  installedPluginsDir: string,
): void {
  const installedSources = pluginSources.filter((source) => source.kind === "installed");

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
}
