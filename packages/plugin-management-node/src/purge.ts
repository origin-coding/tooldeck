import { TooldeckError } from "@tooldeck/shared";

import type { PluginManagementContext } from "./internal";
import type { PurgeablePluginDataSummary, PurgedPluginSummary } from "./types";

export function listPurgeablePluginData(
  context: PluginManagementContext,
): PurgeablePluginDataSummary[] {
  const installedPluginIds = new Set(context.installs.list().map((install) => install.pluginId));
  const registeredPluginIds = new Set(context.plugins.list().map((plugin) => plugin.id));
  const states = new Map(context.states.list().map((state) => [state.pluginId, state]));
  const kvCounts = new Map<string, number>();

  for (const entry of context.kv.list()) {
    kvCounts.set(entry.pluginId, (kvCounts.get(entry.pluginId) ?? 0) + 1);
  }

  return [...new Set([...states.keys(), ...kvCounts.keys()])]
    .filter((pluginId) => !installedPluginIds.has(pluginId) && !registeredPluginIds.has(pluginId))
    .sort((left, right) => left.localeCompare(right))
    .map((pluginId) => ({
      kvEntries: kvCounts.get(pluginId) ?? 0,
      pluginId,
      statePresent: states.has(pluginId),
    }));
}

export function purgePluginData(
  context: PluginManagementContext,
  pluginId: string,
): PurgedPluginSummary {
  let transactionStarted = false;

  try {
    context.database.sqlite.exec("begin immediate;");
    transactionStarted = true;

    const install = context.installs.getById(pluginId);

    if (install) {
      throw new TooldeckError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin must be uninstalled before its local data can be purged: ${pluginId}`,
        details: {
          pluginId,
          installDir: install.installDir,
        },
      });
    }

    const removedKv = context.kv.deleteByPlugin(pluginId);
    const removedState = context.states.delete(pluginId);

    context.database.sqlite.exec("commit;");

    return {
      kvEntriesRemoved: removedKv.length,
      pluginId,
      stateRemoved: removedState !== undefined,
    };
  } catch (error) {
    if (transactionStarted) {
      context.database.sqlite.exec("rollback;");
    }

    throw error;
  }
}
