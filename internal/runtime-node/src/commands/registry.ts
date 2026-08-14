import type { CommandResult } from "@tooldeck/protocol";
import type { CommandHandler, CommandInput, CommandRegistry, Disposable } from "@tooldeck/sdk-node";

import { validateCommandResult } from "@/commands/output-validation";
import { RuntimeError, toRuntimeError } from "@/errors/error";

export interface RegisteredCommand {
  id: string;
  handler: CommandHandler;
}

export interface RunCommandOptions {
  commandId: string;
  input?: CommandInput;
}

export type CommandRunResult =
  | {
      ok: true;
      result: CommandResult;
    }
  | {
      ok: false;
      error: RuntimeError;
      result: CommandResult;
    };

export class RuntimeCommandRegistry implements CommandRegistry<Record<string, CommandInput>> {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(commandId: string, handler: CommandHandler<CommandInput>): Disposable {
    if (this.commands.has(commandId)) {
      throw new RuntimeError({
        code: "ERR_ALREADY_EXISTS",
        message: `Command is already registered: ${commandId}`,
      });
    }

    const command: RegisteredCommand = {
      id: commandId,
      handler,
    };

    this.commands.set(commandId, command);

    return {
      dispose: () => {
        if (this.commands.get(commandId) === command) {
          this.commands.delete(commandId);
        }
      },
    };
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  list(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  async run(options: RunCommandOptions): Promise<CommandResult> {
    const command = this.commands.get(options.commandId);

    if (!command) {
      throw new RuntimeError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not registered: ${options.commandId}`,
      });
    }

    return validateCommandResult({
      commandId: options.commandId,
      result: await command.handler(options.input ?? {}),
    });
  }

  async tryRun(options: RunCommandOptions): Promise<CommandRunResult> {
    try {
      return {
        ok: true,
        result: await this.run(options),
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
}
