import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CommandRegistry,
  PluginContextV1,
  PluginStorage,
  ToolboxPluginV1,
} from "@tooldeck/sdk-node";

import type { PluginHost, PluginHostActivateOptions } from "@/core/plugin-host";
import { RuntimeError, toRuntimeError } from "@/errors/runtime-error";

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
      let cleanupFailed = false;
      let cleanupError: unknown;

      try {
        await this.disposeSubscriptions(context);
      } catch (subscriptionError) {
        cleanupFailed = true;
        cleanupError = subscriptionError;
      }

      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to activate plugin: ${options.pluginId}`,
        cause: error,
        ...(!cleanupFailed
          ? {}
          : {
              details: {
                cleanupError: toRuntimeError(cleanupError).message,
              },
            }),
      });
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

    const errors: unknown[] = [];

    try {
      await activePlugin.plugin.deactivate?.(activePlugin.context);
    } catch (error) {
      errors.push(error);
    }

    try {
      await this.disposeSubscriptions(activePlugin.context);
    } catch (error) {
      errors.push(error);
    }

    activePlugin.context.subscriptions.length = 0;

    if (errors.length > 0) {
      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to deactivate plugin: ${pluginId}`,
        details: {
          errors: errors.map((error) => toRuntimeError(error).message),
        },
      });
    }
  }

  async dispose(): Promise<void> {
    await this.disposeAll();
  }

  async disposeAll(): Promise<void> {
    const pluginIds = [...this.activePlugins.keys()].toReversed();
    const errors: { pluginId: string; code: string; message: string }[] = [];

    for (const pluginId of pluginIds) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        const runtimeError = toRuntimeError(error);

        errors.push({
          pluginId,
          code: runtimeError.code,
          message: runtimeError.message,
        });
      }
    }

    if (errors.length > 0) {
      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: "Failed to dispose all active plugins",
        details: {
          errors,
        },
      });
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
    const errors: unknown[] = [];

    for (const subscription of subscriptions) {
      try {
        await subscription.dispose();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new RuntimeError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to dispose ${errors.length} plugin subscription(s): ${context.pluginId}`,
        details: {
          errors: errors.map((error) => toRuntimeError(error).message),
        },
      });
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
