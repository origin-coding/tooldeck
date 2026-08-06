import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput } from "@tooldeck/sdk-node";

import { normalizeCommandInput, type CommandInputCoercion } from "@/commands/command-input";
import { validateCommandOutputSchema } from "@/commands/command-output-schema-validation";
import type { CommandRunResult, RuntimeCommandRegistry } from "@/commands/command-registry";
import { PluginHostRegistry } from "@/composition/host-registry";
import type { PluginHost } from "@/core/plugin-host";
import { runRuntimeEffectPromise } from "@/effects/runtime-effect";
import { RuntimeError, toRuntimeError } from "@/errors/runtime-error";
import {
  initialPluginRuntimeState,
  PluginRuntimeLifecycleMachine,
  type PluginRuntimeState,
} from "@/lifecycle/plugin-runtime-lifecycle";
import type { IndexedCommand, IndexedPlugin, ManifestIndex } from "@/manifests/manifest-index";

export interface PluginManagerOptions {
  manifestIndex: ManifestIndex;
  commandRegistry: RuntimeCommandRegistry;
  hostRegistry: PluginHostRegistry;
}

export interface RunPluginCommandOptions {
  commandId: string;
  input?: CommandInput;
  coercion?: CommandInputCoercion;
}

export class PluginManager {
  private readonly manifestIndex: ManifestIndex;
  private readonly commandRegistry: RuntimeCommandRegistry;
  private readonly hostRegistry: PluginHostRegistry;
  private readonly pluginLifecycles = new Map<string, PluginRuntimeLifecycleMachine>();
  private readonly pendingActivations = new Map<string, Promise<void>>();

  constructor(options: PluginManagerOptions) {
    this.manifestIndex = options.manifestIndex;
    this.commandRegistry = options.commandRegistry;
    this.hostRegistry = options.hostRegistry;
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
      const runtimeError = toRuntimeError(error);

      return {
        ok: false,
        error: runtimeError,
        result: {
          status: "error",
          blocks: [],
          error: {
            message: runtimeError.message,
            code: runtimeError.code,
            metadata: runtimeError.details,
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
      throw new RuntimeError({
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
      throw new RuntimeError({
        code: "ERR_NOT_FOUND",
        message: `Plugin is not indexed: ${indexedCommand.pluginId}`,
      });
    }

    const host = this.hostRegistry.require(plugin.manifest.runtime.kind, {
      pluginId: plugin.id,
    });

    if (this.pendingActivations.has(plugin.id) || !host.hasPlugin(plugin.id)) {
      await this.activatePluginOnce(plugin, host);
    }

    if (!this.commandRegistry.has(commandId)) {
      throw new RuntimeError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Plugin did not register command after activation: ${commandId}`,
        details: {
          commandId,
          pluginId: plugin.id,
        },
      });
    }
  }

  private async activatePluginOnce(plugin: IndexedPlugin, host: PluginHost): Promise<void> {
    let activation = this.pendingActivations.get(plugin.id);

    if (!activation) {
      activation = this.activatePlugin(plugin, host);
      this.pendingActivations.set(plugin.id, activation);
    }

    try {
      await activation;
    } finally {
      if (this.pendingActivations.get(plugin.id) === activation) {
        this.pendingActivations.delete(plugin.id);
      }
    }
  }

  private async activatePlugin(plugin: IndexedPlugin, host: PluginHost): Promise<void> {
    const lifecycle = this.getPluginLifecycle(plugin.id);

    lifecycle.dispatch("activationRequested");

    try {
      await runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: plugin.id,
          entryPath: plugin.entryPath,
        }),
      );
      lifecycle.dispatch("activated");
    } catch (error) {
      lifecycle.dispatch("activationFailed");
      throw error;
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
