import type { PluginRuntime } from "@tooldeck/protocol";

export type PluginRuntimeKind = PluginRuntime["kind"];

export interface PluginHostActivateOptions {
  pluginId: string;
  entryPath: string;
}

export interface PluginHost<RuntimeKind extends string = PluginRuntimeKind> {
  readonly kind: RuntimeKind;
  hasPlugin(pluginId: string): boolean;
  activatePlugin(options: PluginHostActivateOptions): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  dispose(): Promise<void>;
}
