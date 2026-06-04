import type { CommandResult, TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";

export interface DesktopCommand {
  id: string;
  pluginId: string;
  title: string;
  description?: string;
  inputSchema?: TooldeckJsonSchema;
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

export interface DesktopApi {
  listCommands(): Promise<DesktopCommand[]>;
  runCommand(request: RunCommandRequest): Promise<CommandResult>;
  listCommandRuns(limit?: number): Promise<CommandRunRecord[]>;
}

export const desktopIpcChannels = {
  listCommands: "tooldeck:list-commands",
  runCommand: "tooldeck:run-command",
  listCommandRuns: "tooldeck:list-command-runs",
} as const;
