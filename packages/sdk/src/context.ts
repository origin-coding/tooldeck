import type { CommandRegistry } from "./commands";
import type { Disposable } from "./disposable";

export interface PluginContextV1 {
  pluginId: string;
  subscriptions: Disposable[];
  commands: CommandRegistry;
}

export type PluginContext = PluginContextV1;
