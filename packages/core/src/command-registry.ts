import type { CommandResult } from "@tooldeck/protocol";
import type {
  CommandHandler,
  CommandInput,
  CommandRegistry as SdkCommandRegistry,
  Disposable,
} from "@tooldeck/sdk";
import { TooldeckError, toTooldeckError } from "@tooldeck/shared";

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
      error: TooldeckError;
      result: CommandResult;
    };

export class CommandRegistry implements SdkCommandRegistry<Record<string, CommandInput>> {
  private readonly commands = new Map<string, RegisteredCommand>();

  register(commandId: string, handler: CommandHandler<CommandInput>): Disposable {
    if (this.commands.has(commandId)) {
      throw new TooldeckError({
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
      throw new TooldeckError({
        code: "ERR_COMMAND_NOT_FOUND",
        message: `Command is not registered: ${options.commandId}`,
      });
    }

    return command.handler(options.input ?? {});
  }

  async tryRun(options: RunCommandOptions): Promise<CommandRunResult> {
    try {
      return {
        ok: true,
        result: await this.run(options),
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
}
