import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput } from "@tooldeck/sdk-node";

import type { CommandInputCoercion } from "@/commands/input";
import type { CommandRunResult, RuntimeCommandRegistry } from "@/commands/registry";
import { runRuntimeEffectPromise, runRuntimeEffectSync } from "@/effect";
import { RuntimeError, toRuntimeError } from "@/errors/error";
import type { PluginHost } from "@/hosts/host";
import { PluginHostRegistry } from "@/hosts/registry";
import {
  initialPluginRuntimeState,
  makePluginRuntimeLifecycleMachine,
  type PluginRuntimeLifecycleMachine,
  type PluginRuntimeState,
} from "@/lifecycle/plugin-runtime";
import type { IndexedCommand, IndexedPlugin, ManifestIndex } from "@/manifests/catalog";

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
    return (await this.runCommandWithInput(options)).result;
  }

  async runCommandWithInput(
    options: RunPluginCommandOptions,
  ): Promise<{ input: CommandInput; result: CommandResult }> {
    const indexedCommand = this.getIndexedCommandOrThrow(options.commandId);
    const input = this.normalizeCommandInput(options);

    await this.ensureCommandPluginActivated(indexedCommand);

    const result = await this.commandRegistry.run({
      commandId: options.commandId,
      input,
    });

    this.manifestIndex.validateCommandOutput({
      commandId: options.commandId,
      result,
    });

    return { input, result };
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
    return this.manifestIndex.normalizeCommandInput({
      input: options.input ?? {},
      commandId: options.commandId,
      coercion: options.coercion ?? "none",
    });
  }

  getPluginRuntimeState(pluginId: string): PluginRuntimeState {
    const lifecycle = this.pluginLifecycles.get(pluginId);

    return lifecycle ? runRuntimeEffectSync(lifecycle.state) : initialPluginRuntimeState;
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

    runRuntimeEffectSync(lifecycle.dispatch({ type: "activationRequested" }));

    try {
      await runRuntimeEffectPromise(
        host.activatePlugin({
          pluginId: plugin.id,
          entryPath: plugin.entryPath,
        }),
      );
      runRuntimeEffectSync(lifecycle.dispatch({ type: "activated" }));
    } catch (error) {
      runRuntimeEffectSync(lifecycle.dispatch({ type: "activationFailed" }));
      throw error;
    }
  }

  private getPluginLifecycle(pluginId: string): PluginRuntimeLifecycleMachine {
    let lifecycle = this.pluginLifecycles.get(pluginId);

    if (!lifecycle) {
      lifecycle = runRuntimeEffectSync(makePluginRuntimeLifecycleMachine());
      this.pluginLifecycles.set(pluginId, lifecycle);
    }

    return lifecycle;
  }
}
