import type { PluginManifest } from "@tooldeck/protocol";
import { eq } from "drizzle-orm";

import type { TooldeckDrizzleDatabase } from "../database";
import { plugins, type PluginRow } from "../schema";

export interface UpsertPluginInput {
  manifest: PluginManifest;
  manifestPath: string;
  enabled?: boolean;
  now?: number;
}

export class PluginRepository {
  constructor(private readonly db: TooldeckDrizzleDatabase) {}

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
    return this.db.select().from(plugins).all();
  }

  listEnabled(): PluginRow[] {
    return this.db.select().from(plugins).where(eq(plugins.enabled, true)).all();
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
