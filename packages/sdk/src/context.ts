import type { CommandInput, CommandInputMap, CommandRegistry } from "./commands";
import type { Disposable } from "./disposable";

export interface PluginContextV1<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  pluginId: string;
  subscriptions: Disposable[];
  commands: CommandRegistry<TCommandInputs>;
}

export type PluginContext<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> =
  PluginContextV1<TCommandInputs>;
