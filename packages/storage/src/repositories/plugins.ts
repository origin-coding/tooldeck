import type { PluginManifest } from "@tooldeck/protocol";
import { asc, eq, notInArray } from "drizzle-orm";

import type { TooldeckDatabase } from "../database";
import { plugins } from "../schema";
import type { PluginRow } from "./types";

export interface UpsertPluginInput {
  manifest: PluginManifest;
  manifestPath: string;
  enabled?: boolean;
  now?: number;
}

export interface SyncScannedPluginsInput {
  plugins: UpsertPluginInput[];
  now?: number;
}

export class PluginRepository {
  constructor(private readonly db: TooldeckDatabase["db"]) {}

  syncScannedPlugins(input: SyncScannedPluginsInput): PluginRow[] {
    const pluginIds = input.plugins.map((plugin) => plugin.manifest.id);

    if (pluginIds.length === 0) {
      this.db.delete(plugins).run();
    } else {
      this.db.delete(plugins).where(notInArray(plugins.id, pluginIds)).run();
    }

    return input.plugins.map((plugin) =>
      this.upsertScannedPlugin({
        ...plugin,
        now: plugin.now ?? input.now,
      }),
    );
  }

  upsertScannedPlugin(input: UpsertPluginInput): PluginRow {
    const now = input.now ?? Date.now();

    this.db
      .insert(plugins)
      .values({
        id: input.manifest.id,
        nameJson: JSON.stringify(input.manifest.name),
        version: input.manifest.version,
        manifestPath: input.manifestPath,
        enabled: input.enabled ?? true,
        installedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: plugins.id,
        set: {
          nameJson: JSON.stringify(input.manifest.name),
          version: input.manifest.version,
          manifestPath: input.manifestPath,
          updatedAt: now,
        },
      })
      .run();

    return this.getById(input.manifest.id)!;
  }

  getById(pluginId: string): PluginRow | undefined {
    return this.db.select().from(plugins).where(eq(plugins.id, pluginId)).get();
  }

  list(): PluginRow[] {
    return this.db.select().from(plugins).orderBy(asc(plugins.id)).all();
  }

  listEnabled(): PluginRow[] {
    return this.db
      .select()
      .from(plugins)
      .where(eq(plugins.enabled, true))
      .orderBy(asc(plugins.id))
      .all();
  }

  setEnabled(pluginId: string, enabled: boolean, now = Date.now()): PluginRow | undefined {
    this.db
      .update(plugins)
      .set({
        enabled,
        updatedAt: now,
      })
      .where(eq(plugins.id, pluginId))
      .run();

    return this.getById(pluginId);
  }
}
