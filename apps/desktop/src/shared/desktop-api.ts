import type { CommandResult, TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";

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
}

export interface DesktopPlugin {
  id: string;
  name: string;
  version: string;
  manifestPath: string;
  enabled: boolean;
  runtimeState: DesktopPluginRuntimeState;
  commandCount: number;
  updatedAt: number;
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

export interface RunCommandRequest {
  commandId: string;
  input?: JsonObject;
}

export interface SetPluginEnabledRequest {
  pluginId: string;
  enabled: boolean;
}

export interface DesktopApi {
  listCommands(): Promise<DesktopCommand[]>;
  listPlugins(): Promise<DesktopPlugin[]>;
  setPluginEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
  rescanPlugins(): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
  runCommand(request: RunCommandRequest): Promise<CommandResult>;
  listCommandRuns(limit?: number): Promise<CommandRunRecord[]>;
}

export const desktopIpcChannels = {
  listCommands: "tooldeck:list-commands",
  listPlugins: "tooldeck:list-plugins",
  setPluginEnabled: "tooldeck:set-plugin-enabled",
  rescanPlugins: "tooldeck:rescan-plugins",
  runCommand: "tooldeck:run-command",
  listCommandRuns: "tooldeck:list-command-runs",
} as const;
