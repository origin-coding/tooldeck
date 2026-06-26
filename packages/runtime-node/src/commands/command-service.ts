import type { CommandResult } from "@tooldeck/protocol";

import type { PluginManager } from "../plugins/plugin-manager";
import type { CommandInput } from "./types";
import type { CommandInputCoercion } from "./command-input";

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
    const input = this.pluginManager.normalizeCommandInput({
      commandId: options.commandId,
      input: options.input,
      coercion: this.coercion,
    });
    const result = await this.pluginManager.runCommand({
      commandId: options.commandId,
      input,
    });

    return {
      commandId: options.commandId,
      input,
      result,
    };
  }
}
