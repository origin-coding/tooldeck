import type { MaybePromise } from "@tooldeck/shared";

import type { CommandInput, CommandInputMap } from "./commands";
import type { PluginContextV1 } from "./context";

export interface ToolboxPluginV1<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  activate(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
  deactivate?(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
}

export type ToolboxPlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> =
  ToolboxPluginV1<TCommandInputs>;

export function definePlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>>(
  plugin: ToolboxPluginV1<TCommandInputs>,
): ToolboxPluginV1<TCommandInputs> {
  return plugin;
}
