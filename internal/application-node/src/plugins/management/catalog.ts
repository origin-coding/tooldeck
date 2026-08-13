import path from "node:path";

import { ManifestIndex, scanPluginSources } from "@tooldeck/runtime-node";

import { ApplicationError } from "@/errors/application-error";
import type { PluginManagementContext } from "@/plugins/management/internal";
import type { PluginCatalogSnapshot } from "@/plugins/management/types";
import type { PluginRepository, PluginRow } from "@/storage";

export function syncPluginCatalog(
  context: PluginManagementContext,
  manifestIndex: ManifestIndex,
): PluginRow[] {
  return syncPluginRepository(context.plugins, manifestIndex);
}

export function syncPluginRepository(
  plugins: Pick<PluginRepository, "list" | "syncScannedPlugins">,
  manifestIndex: ManifestIndex,
): PluginRow[] {
  plugins.syncScannedPlugins({
    plugins: manifestIndex.listPlugins().map((plugin) => ({
      manifest: plugin.manifest,
      manifestPath: plugin.manifestPath,
      sourceKind: plugin.source.kind,
      installDir: plugin.source.kind === "installed" ? path.dirname(plugin.manifestPath) : null,
    })),
  });

  return plugins.list();
}

export async function scanAndSyncPluginCatalog(
  context: PluginManagementContext,
): Promise<PluginCatalogSnapshot> {
  const manifestIndex = new ManifestIndex();

  await scanPluginSources({
    sources: context.pluginSources,
    manifestIndex,
  });

  return {
    manifestIndex,
    plugins: syncPluginCatalog(context, manifestIndex),
  };
}

export async function setManagedPluginEnabled(
  context: PluginManagementContext,
  pluginId: string,
  enabled: boolean,
): Promise<PluginRow> {
  await scanAndSyncPluginCatalog(context);

  const plugin = context.plugins.setEnabled(pluginId, enabled);

  if (!plugin) {
    throw new ApplicationError({
      source: "application",
      code: "ERR_NOT_FOUND",
      message: `Plugin is not registered: ${pluginId}`,
      details: { pluginId },
    });
  }

  return plugin;
}
