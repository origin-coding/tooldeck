import type { CommandResult } from "@tooldeck/protocol";
import type { JsonObject, MaybePromise } from "@tooldeck/shared";

import type { Disposable } from "./disposable";

export type CommandInput = JsonObject;
export type CommandInputMap = object;

export type CommandHandler<TInput = CommandInput> = (input: TInput) => MaybePromise<CommandResult>;

export interface CommandRegistry<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  register<TCommandId extends keyof TCommandInputs & string>(
    commandId: TCommandId,
    handler: CommandHandler<TCommandInputs[TCommandId]>,
  ): Disposable;
}
