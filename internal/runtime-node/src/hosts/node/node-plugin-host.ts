import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CommandRegistry,
  PluginContextV1,
  PluginStorage,
  ToolboxPluginV1,
} from "@tooldeck/sdk-node";

import type { PluginHost, PluginHostActivateOptions } from "@/core/plugin-host";
import {
  captureRuntimeCleanupFailure,
  combineRuntimePrimaryAndCleanupFailures,
  createRuntimeCleanupError,
  type CapturedRuntimeCleanupFailure,
} from "@/errors/runtime-cleanup";
import { RuntimeError } from "@/errors/runtime-error";

export interface NodePluginHostOptions {
  commandRegistry: CommandRegistry;
  createPluginStorage?: (pluginId: string) => PluginStorage;
}

export type ActivateNodePluginOptions = PluginHostActivateOptions;

export interface ActiveNodePlugin {
  pluginId: string;
  entryPath: string;
  plugin: ToolboxPluginV1;
  context: PluginContextV1;
}

export class NodePluginHost implements PluginHost {
  readonly kind = "node";

  private readonly commandRegistry: CommandRegistry;
  private readonly createPluginStorage: (pluginId: string) => PluginStorage;
  private readonly activePlugins = new Map<string, ActiveNodePlugin>();

  constructor(options: NodePluginHostOptions) {
    this.commandRegistry = options.commandRegistry;
    this.createPluginStorage = options.createPluginStorage ?? createMemoryPluginStorage;
  }

  hasPlugin(pluginId: string): boolean {
    return this.activePlugins.has(pluginId);
  }

  getPlugin(pluginId: string): ActiveNodePlugin | undefined {
    return this.activePlugins.get(pluginId);
  }

  listPlugins(): ActiveNodePlugin[] {
    return [...this.activePlugins.values()];
  }

  async activatePlugin(options: ActivateNodePluginOptions): Promise<void> {
    if (this.activePlugins.has(options.pluginId)) {
      throw new RuntimeError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin is already active: ${options.pluginId}`,
      });
    }

    if (!path.isAbsolute(options.entryPath)) {
      throw new RuntimeError({
        code: "ERR_INVALID_ARGUMENT",
        message: `Node plugin entryPath must be absolute: ${options.entryPath}`,
      });
    }

    const plugin = await this.loadPlugin(options.entryPath);

    const context: PluginContextV1 = {
      pluginId: options.pluginId,
      subscriptions: [],
      commands: this.commandRegistry,
      storage: this.createPluginStorage(options.pluginId),
    };

    try {
      await plugin.activate(context);
    } catch (error) {
      const primaryError = new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to activate plugin: ${options.pluginId}`,
        cause: error,
      });
      const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

      try {
        await this.disposeSubscriptions(context);
      } catch (cleanupError) {
        cleanupFailures.push(
          captureRuntimeCleanupFailure({
            step: "subscriptions.dispose",
            context: { pluginId: options.pluginId },
            error: cleanupError,
          }),
        );
      }

      throw combineRuntimePrimaryAndCleanupFailures(
        primaryError,
        cleanupFailures,
        `Plugin activation and cleanup failed: ${options.pluginId}`,
      );
    }

    this.activePlugins.set(options.pluginId, {
      pluginId: options.pluginId,
      entryPath: options.entryPath,
      plugin,
      context,
    });
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const activePlugin = this.activePlugins.get(pluginId);

    if (!activePlugin) {
      return;
    }

    this.activePlugins.delete(pluginId);

    const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

    try {
      await activePlugin.plugin.deactivate?.(activePlugin.context);
    } catch (error) {
      cleanupFailures.push(
        captureRuntimeCleanupFailure({
          step: "plugin.deactivate",
          context: { pluginId },
          error,
        }),
      );
    }

    try {
      await this.disposeSubscriptions(activePlugin.context);
    } catch (error) {
      cleanupFailures.push(
        captureRuntimeCleanupFailure({
          step: "subscriptions.dispose",
          context: { pluginId },
          error,
        }),
      );
    }

    activePlugin.context.subscriptions.length = 0;

    if (cleanupFailures.length > 0) {
      throw createRuntimeCleanupError(`Failed to deactivate plugin: ${pluginId}`, cleanupFailures);
    }
  }

  async dispose(): Promise<void> {
    await this.disposeAll();
  }

  async disposeAll(): Promise<void> {
    const pluginIds = [...this.activePlugins.keys()].toReversed();
    const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

    for (const pluginId of pluginIds) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        cleanupFailures.push(
          captureRuntimeCleanupFailure({
            step: "plugin.dispose",
            context: { pluginId },
            error,
          }),
        );
      }
    }

    if (cleanupFailures.length > 0) {
      throw createRuntimeCleanupError("Failed to dispose all active plugins", cleanupFailures);
    }
  }

  private async loadPlugin(entryPath: string): Promise<ToolboxPluginV1> {
    let module: unknown;

    try {
      module = await import(pathToFileURL(entryPath).href);
    } catch (error) {
      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to load plugin entry: ${entryPath}`,
        cause: error,
      });
    }

    const plugin = this.getDefaultExport(module);

    if (!this.isToolboxPluginV1(plugin)) {
      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Plugin entry does not export a valid default plugin: ${entryPath}`,
      });
    }

    return plugin;
  }

  private getDefaultExport(module: unknown): unknown {
    if (typeof module !== "object" || module === null || !("default" in module)) {
      return undefined;
    }

    return module.default;
  }

  private isToolboxPluginV1(plugin: unknown): plugin is ToolboxPluginV1 {
    return (
      typeof plugin === "object" &&
      plugin !== null &&
      "activate" in plugin &&
      typeof plugin.activate === "function"
    );
  }

  private async disposeSubscriptions(context: PluginContextV1): Promise<void> {
    const subscriptions = context.subscriptions.splice(0).toReversed();
    const cleanupFailures: CapturedRuntimeCleanupFailure[] = [];

    for (const subscription of subscriptions) {
      try {
        await subscription.dispose();
      } catch (error) {
        cleanupFailures.push(
          captureRuntimeCleanupFailure({
            step: "subscription.dispose",
            context: { pluginId: context.pluginId },
            error,
          }),
        );
      }
    }

    if (cleanupFailures.length > 0) {
      throw createRuntimeCleanupError(
        `Failed to dispose ${cleanupFailures.length} plugin subscription(s): ${context.pluginId}`,
        cleanupFailures,
      );
    }
  }
}

function createMemoryPluginStorage(): PluginStorage {
  const values = new Map<string, unknown>();

  return {
    async get(key) {
      return values.get(key);
    },
    async set(key, value) {
      values.set(key, value);
    },
    async delete(key) {
      values.delete(key);
    },
  };
}
