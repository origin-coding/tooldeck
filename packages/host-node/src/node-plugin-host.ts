import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  CommandRegistry,
  PluginContextV1,
  PluginStorage,
  ToolboxPluginV1,
} from "@tooldeck/runtime-node";
import { TooldeckError, toTooldeckError } from "@tooldeck/shared";

export interface NodePluginHostOptions {
  commandRegistry: CommandRegistry;
  createPluginStorage?: (pluginId: string) => PluginStorage;
}

export interface ActivateNodePluginOptions {
  pluginId: string;
  entryPath: string;
}

export interface ActiveNodePlugin {
  pluginId: string;
  entryPath: string;
  plugin: ToolboxPluginV1;
  context: PluginContextV1;
}

export class NodePluginHost {
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

  async activatePlugin(options: ActivateNodePluginOptions): Promise<ActiveNodePlugin> {
    if (this.activePlugins.has(options.pluginId)) {
      throw new TooldeckError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin is already active: ${options.pluginId}`,
      });
    }

    if (!path.isAbsolute(options.entryPath)) {
      throw new TooldeckError({
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
      await this.disposeSubscriptions(context);
      throw new TooldeckError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to activate plugin: ${options.pluginId}`,
        cause: error,
      });
    }

    const activePlugin: ActiveNodePlugin = {
      pluginId: options.pluginId,
      entryPath: options.entryPath,
      plugin,
      context,
    };

    this.activePlugins.set(options.pluginId, activePlugin);

    return activePlugin;
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
      throw new TooldeckError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to deactivate plugin: ${pluginId}`,
        details: {
          errors: errors.map((error) => toTooldeckError(error).message),
        },
      });
    }
  }

  async disposeAll(): Promise<void> {
    const pluginIds = [...this.activePlugins.keys()].toReversed();
    const errors: { pluginId: string; code: string; message: string }[] = [];

    for (const pluginId of pluginIds) {
      try {
        await this.deactivatePlugin(pluginId);
      } catch (error) {
        const tooldeckError = toTooldeckError(error);

        errors.push({
          pluginId,
          code: tooldeckError.code,
          message: tooldeckError.message,
        });
      }
    }

    if (errors.length > 0) {
      throw new TooldeckError({
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
      throw new TooldeckError({
        code: "ERR_PLUGIN_LOAD_FAILED",
        message: `Failed to load plugin entry: ${entryPath}`,
        cause: error,
      });
    }

    const plugin = this.getDefaultExport(module);

    if (!this.isToolboxPluginV1(plugin)) {
      throw new TooldeckError({
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
    for (const subscription of context.subscriptions.toReversed()) {
      await subscription.dispose();
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
