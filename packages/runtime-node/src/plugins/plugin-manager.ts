import type { CommandResult } from "@tooldeck/protocol";
import { TooldeckError, toTooldeckError } from "@tooldeck/shared";

import { normalizeCommandInput, type CommandInputCoercion } from "../commands/command-input";
import type { CommandRunResult, RuntimeCommandRegistry } from "../commands/command-registry";
import type { CommandInput } from "../commands/types";
import { validateCommandOutputSchema } from "../commands/command-result-validation";
import {
  initialPluginRuntimeState,
  PluginRuntimeLifecycleMachine,
  type PluginRuntimeState,
} from "../lifecycle/plugin-runtime-lifecycle";
import type { IndexedCommand, ManifestIndex } from "../manifests/manifest-index";

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
  commandRegistry: RuntimeCommandRegistry;
  pluginHost: PluginHost;
}

export interface RunPluginCommandOptions {
  commandId: string;
  input?: CommandInput;
  coercion?: CommandInputCoercion;
}

export class PluginManager {
  private readonly manifestIndex: ManifestIndex;
  private readonly commandRegistry: RuntimeCommandRegistry;
  private readonly pluginHost: PluginHost;
  private readonly pluginLifecycles = new Map<string, PluginRuntimeLifecycleMachine>();

  constructor(options: PluginManagerOptions) {
    this.manifestIndex = options.manifestIndex;
    this.commandRegistry = options.commandRegistry;
    this.pluginHost = options.pluginHost;
  }

  async runCommand(options: RunPluginCommandOptions): Promise<CommandResult> {
    const indexedCommand = this.getIndexedCommandOrThrow(options.commandId);
    const input = this.normalizeCommandInput(options);

    await this.ensureCommandPluginActivated(indexedCommand);

    const result = await this.commandRegistry.run({
      commandId: options.commandId,
      input,
    });

    validateCommandOutputSchema({
      commandId: options.commandId,
      outputSchema: indexedCommand.definition.outputSchema,
      result,
    });

    return result;
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

  normalizeCommandInput(options: RunPluginCommandOptions): CommandInput {
    const indexedCommand = this.getIndexedCommandOrThrow(options.commandId);

    return normalizeCommandInput({
      input: options.input,
      inputSchema: indexedCommand.definition.inputSchema,
      commandId: options.commandId,
      coercion: options.coercion ?? "none",
    });
  }

  getPluginRuntimeState(pluginId: string): PluginRuntimeState {
    return this.pluginLifecycles.get(pluginId)?.state ?? initialPluginRuntimeState;
  }

  private getIndexedCommandOrThrow(commandId: string): IndexedCommand {
    const indexedCommand = this.manifestIndex.getCommand(commandId);

    if (!indexedCommand) {
      throw new TooldeckError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not contributed by any plugin: ${commandId}`,
      });
    }

    return indexedCommand;
  }

  private async ensureCommandPluginActivated(indexedCommand: IndexedCommand): Promise<void> {
    const commandId = indexedCommand.id;

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
      const lifecycle = this.getPluginLifecycle(plugin.id);

      lifecycle.dispatch("activationRequested");

      try {
        await this.pluginHost.activatePlugin({
          pluginId: plugin.id,
          entryPath: plugin.entryPath,
        });
        lifecycle.dispatch("activated");
      } catch (error) {
        lifecycle.dispatch("activationFailed");
        throw error;
      }
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

  private getPluginLifecycle(pluginId: string): PluginRuntimeLifecycleMachine {
    let lifecycle = this.pluginLifecycles.get(pluginId);

    if (!lifecycle) {
      lifecycle = new PluginRuntimeLifecycleMachine();
      this.pluginLifecycles.set(pluginId, lifecycle);
    }

    return lifecycle;
  }
}
