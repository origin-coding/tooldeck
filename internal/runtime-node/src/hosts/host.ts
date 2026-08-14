import type { PluginRuntime } from "@tooldeck/protocol";
import type { Effect } from "effect";

import type { RuntimeError } from "@/errors/error";

export type PluginRuntimeKind = PluginRuntime["kind"];

export interface PluginHostActivateOptions {
  pluginId: string;
  entryPath: string;
}

export interface PluginHost<RuntimeKind extends string = PluginRuntimeKind> {
  readonly kind: RuntimeKind;
  hasPlugin(pluginId: string): boolean;
  activatePlugin(options: PluginHostActivateOptions): Effect.Effect<void, RuntimeError>;
  deactivatePlugin(pluginId: string): Effect.Effect<void, RuntimeError>;
  dispose(): Effect.Effect<void, RuntimeError>;
}
