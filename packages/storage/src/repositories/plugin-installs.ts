import { asc, eq } from "drizzle-orm";

import type { TooldeckDatabase } from "../database";
import { pluginInstalls } from "../schema";
import type { PluginInstallRow } from "./types";

export interface CreatePluginInstallInput {
  pluginId: string;
  version: string;
  installDir: string;
  manifestPath: string;
  packageName: string;
  packageDigest: string;
  packageSizeBytes: number;
  installedAt?: number;
  updatedAt?: number;
}

export class PluginInstallRepository {
  constructor(private readonly db: TooldeckDatabase["db"]) {}

  create(input: CreatePluginInstallInput): PluginInstallRow {
    const now = Date.now();
    const installedAt = input.installedAt ?? now;
    const updatedAt = input.updatedAt ?? installedAt;

    this.db
      .insert(pluginInstalls)
      .values({
        pluginId: input.pluginId,
        version: input.version,
        installDir: input.installDir,
        manifestPath: input.manifestPath,
        packageName: input.packageName,
        packageDigest: input.packageDigest,
        packageSizeBytes: input.packageSizeBytes,
        installedAt,
        updatedAt,
      })
      .run();

    return this.getById(input.pluginId)!;
  }

  getById(pluginId: string): PluginInstallRow | undefined {
    return this.db
      .select()
      .from(pluginInstalls)
      .where(eq(pluginInstalls.pluginId, pluginId))
      .get();
  }

  list(): PluginInstallRow[] {
    return this.db.select().from(pluginInstalls).orderBy(asc(pluginInstalls.pluginId)).all();
  }

  delete(pluginId: string): PluginInstallRow | undefined {
    const existing = this.getById(pluginId);

    if (!existing) {
      return undefined;
    }

    this.db.delete(pluginInstalls).where(eq(pluginInstalls.pluginId, pluginId)).run();

    return existing;
  }
}
