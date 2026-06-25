import type { CommandInput, CommandInputMap, CommandRegistry } from "../commands/types";
import type { Disposable } from "../disposable";

export interface PluginStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PluginContextV1<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  pluginId: string;
  subscriptions: Disposable[];
  commands: CommandRegistry<TCommandInputs>;
  storage: PluginStorage;
}

export type PluginContext<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> =
  PluginContextV1<TCommandInputs>;
