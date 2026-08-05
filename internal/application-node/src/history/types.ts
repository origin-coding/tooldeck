import type { CommandResult, JsonValue } from "@tooldeck/protocol";

import type { ApplicationErrorEvidenceFormat } from "@/history/error-evidence";

export interface ListApplicationCommandRunsRequest {
  limit?: number;
  commandId?: string;
}

export interface ApplicationCommandRun {
  id: string;
  commandId: string;
  pluginId?: string;
  source: string;
  status: CommandResult["status"];
  input?: JsonValue;
  output?: CommandResult;
  error?: JsonValue;
  errorFormat?: ApplicationErrorEvidenceFormat;
  durationMs?: number;
  createdAt: number;
}

export interface ApplicationHistoryFacade {
  listCommandRuns(request?: ListApplicationCommandRunsRequest): Promise<ApplicationCommandRun[]>;
}
