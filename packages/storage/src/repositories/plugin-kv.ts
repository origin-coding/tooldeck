import { and, asc, eq } from "drizzle-orm";

import type { TooldeckDatabase } from "../database";
import { pluginKv } from "../schema";
import type { PluginKvRow } from "./types";

export interface SetPluginKvInput {
  pluginId: string;
  key: string;
  value: unknown;
  now?: number;
}

export class PluginKvRepository {
  constructor(private readonly db: TooldeckDatabase["db"]) {}

  get(pluginId: string, key: string): unknown | undefined {
    const row = this.getRow(pluginId, key);

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.valueJson);
  }

  set(input: SetPluginKvInput): PluginKvRow {
    const now = input.now ?? Date.now();
    const valueJson = JSON.stringify(input.value);

    if (valueJson === undefined) {
      throw new TypeError("Plugin KV value must be JSON serializable");
    }

    this.db
      .insert(pluginKv)
      .values({
        pluginId: input.pluginId,
        key: input.key,
        valueJson,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pluginKv.pluginId, pluginKv.key],
        set: {
          valueJson,
          updatedAt: now,
        },
      })
      .run();

    return this.getRow(input.pluginId, input.key)!;
  }

  delete(pluginId: string, key: string): void {
    this.db
      .delete(pluginKv)
      .where(and(eq(pluginKv.pluginId, pluginId), eq(pluginKv.key, key)))
      .run();
  }

  deleteByPlugin(pluginId: string): PluginKvRow[] {
    const existing = this.listByPlugin(pluginId);

    if (existing.length === 0) {
      return [];
    }

    this.db.delete(pluginKv).where(eq(pluginKv.pluginId, pluginId)).run();

    return existing;
  }

  list(): PluginKvRow[] {
    return this.db.select().from(pluginKv).orderBy(asc(pluginKv.pluginId), asc(pluginKv.key)).all();
  }

  listByPlugin(pluginId: string): PluginKvRow[] {
    return this.db
      .select()
      .from(pluginKv)
      .where(eq(pluginKv.pluginId, pluginId))
      .orderBy(asc(pluginKv.key))
      .all();
  }

  private getRow(pluginId: string, key: string): PluginKvRow | undefined {
    return this.db
      .select()
      .from(pluginKv)
      .where(and(eq(pluginKv.pluginId, pluginId), eq(pluginKv.key, key)))
      .get();
  }
}
