import type { PluginManifest } from "@tooldeck/protocol";
import { asc, eq, notInArray } from "drizzle-orm";

import type { TooldeckDatabase } from "../database";
import { plugins, pluginStates } from "../schema";
import type { PluginRow } from "./types";

export type PluginSourceKind = "builtin" | "installed" | "external";

export interface UpsertPluginInput {
  manifest: PluginManifest;
  manifestPath: string;
  sourceKind?: PluginSourceKind;
  installDir?: string | null;
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
    const sourceKind = input.sourceKind ?? "builtin";

    this.db
      .insert(plugins)
      .values({
        id: input.manifest.id,
        nameJson: JSON.stringify(input.manifest.name),
        version: input.manifest.version,
        manifestPath: input.manifestPath,
        sourceKind,
        installDir: input.installDir ?? null,
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
          sourceKind,
          installDir: input.installDir ?? null,
          updatedAt: now,
        },
      })
      .run();

    this.ensurePluginState(input.manifest.id, input.enabled ?? true, now);

    return this.getById(input.manifest.id)!;
  }

  getById(pluginId: string): PluginRow | undefined {
    const plugin = this.db.select().from(plugins).where(eq(plugins.id, pluginId)).get();

    if (!plugin) {
      return undefined;
    }

    const state = this.db
      .select()
      .from(pluginStates)
      .where(eq(pluginStates.pluginId, pluginId))
      .get();

    return {
      ...plugin,
      enabled: state?.enabled ?? plugin.enabled,
    };
  }

  list(): PluginRow[] {
    return this.db
      .select()
      .from(plugins)
      .orderBy(asc(plugins.id))
      .all()
      .map((plugin) => ({
        ...plugin,
        enabled: this.getPluginStateEnabled(plugin.id) ?? plugin.enabled,
      }));
  }

  listEnabled(): PluginRow[] {
    return this.list().filter((plugin) => plugin.enabled);
  }

  setEnabled(pluginId: string, enabled: boolean, now = Date.now()): PluginRow | undefined {
    const plugin = this.getById(pluginId);

    if (!plugin) {
      return undefined;
    }

    this.db
      .insert(pluginStates)
      .values({
        pluginId,
        enabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: pluginStates.pluginId,
        set: {
          enabled,
          updatedAt: now,
        },
      })
      .run();

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

  private ensurePluginState(pluginId: string, enabled: boolean, now: number): void {
    this.db
      .insert(pluginStates)
      .values({
        pluginId,
        enabled,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();
  }

  private getPluginStateEnabled(pluginId: string): boolean | undefined {
    return this.db
      .select({ enabled: pluginStates.enabled })
      .from(pluginStates)
      .where(eq(pluginStates.pluginId, pluginId))
      .get()?.enabled;
  }
}
