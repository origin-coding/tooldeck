import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PluginManagementService } from "@tooldeck/plugin-management-node";
import { createRuntime } from "@tooldeck/runtime-node";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
} from "@tooldeck/storage";

import { TooldeckDesktopServiceContext } from "./context";
import type { DesktopLifecycleService } from "./types";

export class TooldeckDesktopRuntimeService implements DesktopLifecycleService {
  constructor(private readonly context: TooldeckDesktopServiceContext) {}

  async start(): Promise<void> {
    await mkdir(path.dirname(this.context.storagePath), { recursive: true });

    this.context.database = openTooldeckDatabase({ path: this.context.storagePath });
    this.context.commandRuns = new CommandRunRepository(this.context.database.db);
    this.context.preferences = new PreferenceRepository(this.context.database.db);
    this.context.plugins = new PluginRepository(this.context.database.db);
    this.context.pluginKv = new PluginKvRepository(this.context.database.db);
    this.context.pluginManagement = new PluginManagementService({
      database: this.context.database,
      installedPluginsDir: this.context.installedPluginsDir,
      pluginSources: this.context.pluginSources,
    });

    await this.scanAndCreateRuntime();
  }

  async dispose(): Promise<void> {
    let runtimeFailed = false;
    let runtimeError: unknown;

    try {
      await this.disposePluginRuntime();
    } catch (error) {
      runtimeFailed = true;
      runtimeError = error;
    }

    const database = this.context.database;
    this.context.database = undefined;

    try {
      database?.close();
    } catch (databaseError) {
      if (runtimeFailed) {
        throw new AggregateError(
          [runtimeError, databaseError],
          "Desktop runtime and database cleanup both failed.",
          { cause: runtimeError },
        );
      }

      throw databaseError;
    }

    if (runtimeFailed) {
      throw runtimeError;
    }
  }

  async disposePluginRuntime(): Promise<void> {
    const pluginRuntime = this.context.pluginRuntime;

    this.context.pluginRuntime = undefined;
    this.context.pluginManager = undefined;
    this.context.commandService = undefined;
    this.context.manifestIndex = undefined;

    await pluginRuntime?.dispose();
  }

  async scanAndCreateRuntime(): Promise<void> {
    await this.disposePluginRuntime();

    const pluginKv = this.context.requirePluginKv();
    const runtime = await createRuntime({
      pluginSources: this.context.pluginSources,
      createPluginStorage(pluginId) {
        return {
          async get(key) {
            return pluginKv.get(pluginId, key);
          },
          async set(key, value) {
            pluginKv.set({
              pluginId,
              key,
              value,
            });
          },
          async delete(key) {
            pluginKv.delete(pluginId, key);
          },
        };
      },
      afterScan: ({ manifestIndex }) => {
        this.context.requirePluginManagement().syncCatalog(manifestIndex);
      },
    });

    this.context.pluginRuntime = runtime;
    this.context.pluginManager = runtime.pluginManager;
    this.context.manifestIndex = runtime.manifestIndex;
    this.context.commandService = runtime.commandService;
  }
}
