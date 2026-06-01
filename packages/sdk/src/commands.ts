import type { CommandResult } from "@tooldeck/protocol";
import type { JsonObject, MaybePromise } from "@tooldeck/shared";

import type { Disposable } from "./disposable";

export type CommandInput = JsonObject;

export type CommandHandler<TInput = CommandInput> = (input: TInput) => MaybePromise<CommandResult>;

export interface CommandRegistry {
  register<TInput = CommandInput>(commandId: string, handler: CommandHandler<TInput>): Disposable;
}
