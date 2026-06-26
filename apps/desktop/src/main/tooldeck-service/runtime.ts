import { mkdir } from "node:fs/promises";
import path from "node:path";

import { ManifestIndex, scanPluginSources } from "@tooldeck/runtime-node";
import { createNodeRuntime } from "@tooldeck/host-node";
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

    await this.scanAndCreateRuntime();
  }

  async dispose(): Promise<void> {
    try {
      await this.context.pluginHost?.disposeAll();
    } finally {
      this.context.database?.close();
    }
  }

  async scanAndCreateRuntime(): Promise<void> {
    await this.context.pluginHost?.disposeAll();

    const pluginKv = this.context.requirePluginKv();
    const runtime = await createNodeRuntime({
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
        this.syncScannedPluginIndex(manifestIndex);
      },
    });

    this.context.pluginHost = runtime.pluginHost;
    this.context.pluginManager = runtime.pluginManager;
    this.context.manifestIndex = runtime.manifestIndex;
    this.context.commandService = runtime.commandService;
  }

  async syncScannedPlugins(): Promise<ManifestIndex> {
    const manifestIndex = new ManifestIndex();

    await scanPluginSources({
      sources: this.context.pluginSources,
      manifestIndex,
    });
    this.syncScannedPluginIndex(manifestIndex);

    return manifestIndex;
  }

  private syncScannedPluginIndex(manifestIndex: ManifestIndex): void {
    this.context.requirePlugins().syncScannedPlugins({
      plugins: manifestIndex.listPlugins().map((plugin) => ({
        manifest: plugin.manifest,
        manifestPath: plugin.manifestPath,
      })),
    });
  }
}
