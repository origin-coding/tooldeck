import {
  CommandService,
  ManifestIndex,
  PluginManager,
  RuntimeCommandRegistry,
  scanPluginSources,
  type CommandInputCoercion,
  type PluginScanSource,
} from "@tooldeck/runtime-node";
import type { PluginStorage } from "@tooldeck/sdk-node";

import { NodePluginHost } from "./node-plugin-host";

export interface CreateNodeRuntimeAfterScanContext {
  manifestIndex: ManifestIndex;
  pluginCount: number;
  commandCount: number;
}

export interface CreateNodeRuntimeOptions {
  pluginSources: PluginScanSource[];
  coercion?: CommandInputCoercion;
  createPluginStorage?: (pluginId: string) => PluginStorage;
  afterScan?: (context: CreateNodeRuntimeAfterScanContext) => void | Promise<void>;
}

export interface CreatedNodeRuntime {
  commandRegistry: RuntimeCommandRegistry;
  pluginHost: NodePluginHost;
  manifestIndex: ManifestIndex;
  pluginManager: PluginManager;
  commandService: CommandService;
  pluginCount: number;
  commandCount: number;
  dispose(): Promise<void>;
}

export async function createNodeRuntime(
  options: CreateNodeRuntimeOptions,
): Promise<CreatedNodeRuntime> {
  const commandRegistry = new RuntimeCommandRegistry();
  const pluginHost = new NodePluginHost({
    commandRegistry,
    createPluginStorage: options.createPluginStorage,
  });
  const manifestIndex = new ManifestIndex();

  const scanResult = await scanPluginSources({
    sources: options.pluginSources,
    manifestIndex,
  });

  await options.afterScan?.({
    manifestIndex,
    pluginCount: scanResult.pluginCount,
    commandCount: scanResult.commandCount,
  });

  const pluginManager = new PluginManager({
    manifestIndex,
    commandRegistry,
    pluginHost,
  });

  return {
    commandRegistry,
    pluginHost,
    manifestIndex,
    pluginManager,
    commandService: new CommandService({
      pluginManager,
      coercion: options.coercion ?? "none",
    }),
    pluginCount: scanResult.pluginCount,
    commandCount: scanResult.commandCount,
    dispose() {
      return pluginHost.disposeAll();
    },
  };
}
