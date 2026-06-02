import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput } from "@tooldeck/sdk";
import { TooldeckError, toTooldeckError } from "@tooldeck/shared";

import type { CommandRegistry, CommandRunResult } from "./command-registry";
import type { ManifestIndex } from "./manifest-index";

export interface PluginHostActivateOptions {
  pluginId: string;
  entryPath: string;
}

export interface PluginHost {
  hasPlugin(pluginId: string): boolean;
  activatePlugin(options: PluginHostActivateOptions): Promise<unknown>;
}

export interface PluginManagerOptions {
  manifestIndex: ManifestIndex;
  commandRegistry: CommandRegistry;
  pluginHost: PluginHost;
}

export interface RunPluginCommandOptions {
  commandId: string;
  input?: CommandInput;
}

export class PluginManager {
  private readonly manifestIndex: ManifestIndex;
  private readonly commandRegistry: CommandRegistry;
  private readonly pluginHost: PluginHost;

  constructor(options: PluginManagerOptions) {
    this.manifestIndex = options.manifestIndex;
    this.commandRegistry = options.commandRegistry;
    this.pluginHost = options.pluginHost;
  }

  async runCommand(options: RunPluginCommandOptions): Promise<CommandResult> {
    await this.ensureCommandPluginActivated(options.commandId);

    return this.commandRegistry.run({
      commandId: options.commandId,
      input: options.input,
    });
  }

  async tryRunCommand(options: RunPluginCommandOptions): Promise<CommandRunResult> {
    try {
      return {
        ok: true,
        result: await this.runCommand(options),
      };
    } catch (error) {
      const tooldeckError = toTooldeckError(error);

      return {
        ok: false,
        error: tooldeckError,
        result: {
          status: "error",
          blocks: [],
          error: {
            message: tooldeckError.message,
            code: tooldeckError.code,
            metadata: tooldeckError.details,
          },
        },
      };
    }
  }

  private async ensureCommandPluginActivated(commandId: string): Promise<void> {
    const indexedCommand = this.manifestIndex.getCommand(commandId);

    if (!indexedCommand) {
      throw new TooldeckError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not contributed by any plugin: ${commandId}`,
      });
    }

    if (this.commandRegistry.has(commandId)) {
      return;
    }

    const plugin = this.manifestIndex.getPlugin(indexedCommand.pluginId);

    if (!plugin) {
      throw new TooldeckError({
        code: "ERR_NOT_FOUND",
        message: `Plugin is not indexed: ${indexedCommand.pluginId}`,
      });
    }

    if (!this.pluginHost.hasPlugin(plugin.id)) {
      await this.pluginHost.activatePlugin({
        pluginId: plugin.id,
        entryPath: plugin.entryPath,
      });
    }

    if (!this.commandRegistry.has(commandId)) {
      throw new TooldeckError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Plugin did not register command after activation: ${commandId}`,
        details: {
          commandId,
          pluginId: plugin.id,
        },
      });
    }
  }
}
