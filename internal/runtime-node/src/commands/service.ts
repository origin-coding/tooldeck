import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput } from "@tooldeck/sdk-node";

import type { CommandInputCoercion } from "@/commands/input";
import type { PluginManager } from "@/plugins/manager";

export interface CommandServiceOptions {
  pluginManager: PluginManager;
  coercion?: CommandInputCoercion;
}

export interface RunServiceCommandOptions {
  commandId: string;
  input?: CommandInput;
}

export interface RunCommandOutput {
  commandId: string;
  input: CommandInput;
  result: CommandResult;
}

export class CommandService {
  private readonly pluginManager: PluginManager;
  private readonly coercion: CommandInputCoercion;

  constructor(options: CommandServiceOptions) {
    this.pluginManager = options.pluginManager;
    this.coercion = options.coercion ?? "none";
  }

  async runCommand(options: RunServiceCommandOptions): Promise<RunCommandOutput> {
    const execution = await this.pluginManager.runCommandWithInput({
      commandId: options.commandId,
      input: options.input,
      coercion: this.coercion,
    });

    return {
      commandId: options.commandId,
      input: execution.input,
      result: execution.result,
    };
  }
}
