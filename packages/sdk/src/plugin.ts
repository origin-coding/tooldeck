import type { MaybePromise } from "@tooldeck/shared";

import type { PluginContextV1 } from "./context";

export interface ToolboxPluginV1 {
  activate(ctx: PluginContextV1): MaybePromise<void>;
  deactivate?(ctx: PluginContextV1): MaybePromise<void>;
}

export type ToolboxPlugin = ToolboxPluginV1;

export function definePlugin(plugin: ToolboxPluginV1): ToolboxPluginV1 {
  return plugin;
}
