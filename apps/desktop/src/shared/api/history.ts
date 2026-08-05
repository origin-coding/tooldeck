import type { CommandResult, JsonValue } from "@tooldeck/protocol";

export interface CommandRunRecord {
  id: string;
  commandId: string;
  pluginId?: string;
  source: string;
  status: CommandResult["status"];
  input?: JsonValue;
  output?: CommandResult;
  error?: JsonValue;
  errorFormat?: "canonical" | "legacy";
  durationMs?: number;
  createdAt: number;
}

export interface ListCommandRunsRequest {
  limit?: number;
  commandId?: string;
}

export interface DesktopHistoryApi {
  listRuns(request?: ListCommandRunsRequest): Promise<CommandRunRecord[]>;
}
