import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  RuntimeCommandRegistry,
  CommandService,
  ManifestIndex,
  PluginManager,
  scanPluginSources,
} from "@tooldeck/runtime-node";
import { NodePluginHost } from "@tooldeck/host-node";
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

    const commandRegistry = new RuntimeCommandRegistry();
    const manifestIndex = new ManifestIndex();
    const pluginKv = this.context.requirePluginKv();

    const pluginHost = new NodePluginHost({
      commandRegistry,
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
    });

    await scanPluginSources({
      sources: this.context.pluginSources,
      manifestIndex,
    });
    this.syncScannedPluginIndex(manifestIndex);

    const pluginManager = new PluginManager({
      manifestIndex,
      commandRegistry,
      pluginHost,
    });

    this.context.pluginHost = pluginHost;
    this.context.pluginManager = pluginManager;
    this.context.manifestIndex = manifestIndex;
    this.context.commandService = new CommandService({
      pluginManager,
      coercion: "none",
    });
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
