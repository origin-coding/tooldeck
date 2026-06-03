import type { CommandResult } from "@tooldeck/protocol";
import type { CommandInput } from "@tooldeck/sdk";

import type { PluginManager } from "./plugin-manager";

export interface CommandServiceOptions {
  pluginManager: PluginManager;
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

  constructor(options: CommandServiceOptions) {
    this.pluginManager = options.pluginManager;
  }

  async runCommand(options: RunServiceCommandOptions): Promise<RunCommandOutput> {
    const input = this.pluginManager.normalizeCommandInput({
      commandId: options.commandId,
      input: options.input,
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
