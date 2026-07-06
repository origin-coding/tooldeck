import { asc, eq } from "drizzle-orm";

import type { TooldeckDatabase } from "../database";
import { pluginStates } from "../schema";
import type { PluginStateRow } from "./types";

export class PluginStateRepository {
  constructor(private readonly db: TooldeckDatabase["db"]) {}

  ensureDefault(pluginId: string, now = Date.now()): PluginStateRow {
    this.db
      .insert(pluginStates)
      .values({
        pluginId,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .run();

    return this.getById(pluginId)!;
  }

  getById(pluginId: string): PluginStateRow | undefined {
    return this.db.select().from(pluginStates).where(eq(pluginStates.pluginId, pluginId)).get();
  }

  list(): PluginStateRow[] {
    return this.db.select().from(pluginStates).orderBy(asc(pluginStates.pluginId)).all();
  }

  setEnabled(pluginId: string, enabled: boolean, now = Date.now()): PluginStateRow {
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

    return this.getById(pluginId)!;
  }

  delete(pluginId: string): PluginStateRow | undefined {
    const existing = this.getById(pluginId);

    if (!existing) {
      return undefined;
    }

    this.db.delete(pluginStates).where(eq(pluginStates.pluginId, pluginId)).run();

    return existing;
  }
}
