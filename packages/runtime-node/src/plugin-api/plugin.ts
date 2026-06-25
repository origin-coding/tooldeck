import type { CommandInput, CommandInputMap } from "../commands/types";
import type { PluginContextV1 } from "./context";
import type { MaybePromise } from "../types";

export interface ToolboxPluginV1<
  TCommandInputs extends CommandInputMap = Record<string, CommandInput>,
> {
  activate(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
  deactivate?(ctx: PluginContextV1<TCommandInputs>): MaybePromise<void>;
}

export type ToolboxPlugin<TCommandInputs extends CommandInputMap = Record<string, CommandInput>> =
  ToolboxPluginV1<TCommandInputs>;
