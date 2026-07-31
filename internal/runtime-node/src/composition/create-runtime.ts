import type { PluginStorage } from "@tooldeck/sdk-node";

import type { CommandInputCoercion } from "@/commands/command-input";
import { RuntimeCommandRegistry } from "@/commands/command-registry";
import { CommandService } from "@/commands/command-service";
import { PluginHostRegistry } from "@/composition/host-registry";
import type { PluginHost } from "@/core/plugin-host";
import { NodePluginHost } from "@/hosts/node";
import { ManifestIndex } from "@/manifests/manifest-index";
import { PluginManager } from "@/plugins/plugin-manager";
import { scanPluginSources, type PluginScanSource } from "@/plugins/plugin-scanner";

export interface CreateRuntimeAfterScanContext {
  manifestIndex: ManifestIndex;
  pluginCount: number;
  commandCount: number;
}

export interface PluginHostFactoryContext {
  commandRegistry: RuntimeCommandRegistry;
}

export type PluginHostFactory = (context: PluginHostFactoryContext) => PluginHost;

export interface CreateRuntimeOptions {
  pluginSources: PluginScanSource[];
  hostFactories?: readonly PluginHostFactory[];
  coercion?: CommandInputCoercion;
  createPluginStorage?: (pluginId: string) => PluginStorage;
  afterScan?: (context: CreateRuntimeAfterScanContext) => void | Promise<void>;
}

export interface CreatedRuntime {
  commandRegistry: RuntimeCommandRegistry;
  hostRegistry: PluginHostRegistry;
  manifestIndex: ManifestIndex;
  pluginManager: PluginManager;
  commandService: CommandService;
  pluginCount: number;
  commandCount: number;
  dispose(): Promise<void>;
}

export async function createRuntime(options: CreateRuntimeOptions): Promise<CreatedRuntime> {
  const commandRegistry = new RuntimeCommandRegistry();
  const hostRegistry = new PluginHostRegistry();
  const manifestIndex = new ManifestIndex();
  const hostFactories = options.hostFactories ?? [
    ({ commandRegistry: runtimeCommandRegistry }: PluginHostFactoryContext) =>
      new NodePluginHost({
        commandRegistry: runtimeCommandRegistry,
        createPluginStorage: options.createPluginStorage,
      }),
  ];

  for (const createHost of hostFactories) {
    hostRegistry.register(createHost({ commandRegistry }));
  }

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
    hostRegistry,
  });

  return {
    commandRegistry,
    hostRegistry,
    manifestIndex,
    pluginManager,
    commandService: new CommandService({
      pluginManager,
      coercion: options.coercion ?? "none",
    }),
    pluginCount: scanResult.pluginCount,
    commandCount: scanResult.commandCount,
    dispose() {
      return hostRegistry.disposeAll();
    },
  };
}
