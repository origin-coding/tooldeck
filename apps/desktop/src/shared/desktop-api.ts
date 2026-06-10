import type { CommandResult, TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject, PreferenceScope } from "@tooldeck/shared";

export type DesktopPluginRuntimeState =
  | "inactive"
  | "activating"
  | "active"
  | "deactivating"
  | "failed"
  | "disposed";

export interface DesktopCommand {
  id: string;
  pluginId: string;
  pluginEnabled: boolean;
  pluginRuntimeState: DesktopPluginRuntimeState;
  title: string;
  description?: string;
  inputSchema?: TooldeckJsonSchema;
  searchText: string[];
}

export interface DesktopPlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  manifestPath: string;
  enabled: boolean;
  runtimeState: DesktopPluginRuntimeState;
  commandCount: number;
  updatedAt: number;
  searchText: string[];
}

export interface CommandRunRecord {
  id: string;
  commandId: string;
  pluginId?: string;
  source: string;
  status: CommandResult["status"];
  input?: unknown;
  output?: CommandResult;
  error?: unknown;
  durationMs?: number;
  createdAt: number;
}

export interface DesktopPreference {
  scope: PreferenceScope;
  key: string;
  value: unknown;
  defaultValue: unknown;
  description: string;
  valueType: "boolean" | "enum";
  values?: readonly string[];
  updatedAt?: number;
}

export interface RunCommandRequest {
  commandId: string;
  input?: JsonObject;
}

export interface ListCommandRunsRequest {
  limit?: number;
  commandId?: string;
}

export interface SetPreferenceRequest {
  key: string;
  value: unknown;
}

export interface SetPluginEnabledRequest {
  pluginId: string;
  enabled: boolean;
}

export interface DesktopApi {
  listCommands(): Promise<DesktopCommand[]>;
  listPlugins(): Promise<DesktopPlugin[]>;
  listPreferences(): Promise<DesktopPreference[]>;
  setPreference(request: SetPreferenceRequest): Promise<DesktopPreference>;
  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
  rescanPlugins(): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
  runCommand(request: RunCommandRequest): Promise<CommandResult>;
  listCommandRuns(request?: ListCommandRunsRequest): Promise<CommandRunRecord[]>;
}

export const desktopIpcChannels = {
  listCommands: "tooldeck:list-commands",
  listPlugins: "tooldeck:list-plugins",
  listPreferences: "tooldeck:list-preferences",
  setPreference: "tooldeck:set-preference",
  setPluginEnabled: "tooldeck:set-plugin-enabled",
  rescanPlugins: "tooldeck:rescan-plugins",
  runCommand: "tooldeck:run-command",
  listCommandRuns: "tooldeck:list-command-runs",
} as const;
