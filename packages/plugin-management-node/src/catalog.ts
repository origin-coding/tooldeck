import path from "node:path";

import { ManifestIndex, scanPluginSources } from "@tooldeck/runtime-node";
import { TooldeckError } from "@tooldeck/shared";
import type { PluginRow } from "@tooldeck/storage";

import type { PluginManagementContext } from "./internal";
import type { PluginCatalogSnapshot } from "./types";

export function syncPluginCatalog(
  context: PluginManagementContext,
  manifestIndex: ManifestIndex,
): PluginRow[] {
  context.plugins.syncScannedPlugins({
    plugins: manifestIndex.listPlugins().map((plugin) => ({
      manifest: plugin.manifest,
      manifestPath: plugin.manifestPath,
      sourceKind: plugin.source.kind,
      installDir: plugin.source.kind === "installed" ? path.dirname(plugin.manifestPath) : null,
    })),
  });

  return context.plugins.list();
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
    throw new TooldeckError({
      code: "ERR_NOT_FOUND",
      message: `Plugin is not registered: ${pluginId}`,
      details: { pluginId },
    });
  }

  return plugin;
}
