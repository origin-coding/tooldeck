import path from "node:path";

import type { ManifestIndex } from "@tooldeck/runtime-node";
import { TooldeckError } from "@tooldeck/shared";
import { PluginInstallRepository, PluginRepository, type PluginRow } from "@tooldeck/storage";

import { scanAndSyncPluginCatalog, setManagedPluginEnabled, syncPluginCatalog } from "./catalog";
import { installPluginPackage } from "./install";
import type { PluginManagementContext } from "./internal";
import type {
  InstalledPluginSummary,
  PluginCatalogSnapshot,
  PluginManagementServiceOptions,
  UninstalledPluginSummary,
} from "./types";
import { uninstallPlugin } from "./uninstall";

export class PluginManagementService {
  private readonly context: PluginManagementContext;

  constructor(options: PluginManagementServiceOptions) {
    const installedPluginsDir = path.resolve(options.installedPluginsDir);

    assertInstalledSourceConfiguration(options.pluginSources, installedPluginsDir);
    this.context = {
      installedPluginsDir,
      pluginSources: options.pluginSources,
      installs: new PluginInstallRepository(options.database.db),
      plugins: new PluginRepository(options.database.db),
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
    throw new TooldeckError({
      code: "ERR_INVALID_ARGUMENT",
      message: "Plugin management requires exactly one matching installed scan source.",
      details: {
        installedPluginsDir,
        installedSourcePaths: installedSources.map((source) => path.resolve(source.path)),
      },
    });
  }
}
