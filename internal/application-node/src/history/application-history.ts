import type { CommandResult, JsonValue } from "@tooldeck/protocol";

import type { TooldeckApplicationContext } from "@/application/context";
import { runApplicationOperation } from "@/application/edge";
import type {
  ApplicationCommandRun,
  ApplicationHistoryFacade,
  ListApplicationCommandRunsRequest,
} from "@/history/types";

export class ApplicationHistory implements ApplicationHistoryFacade {
  constructor(private readonly context: TooldeckApplicationContext) {}

  listCommandRuns(
    request: ListApplicationCommandRunsRequest = {},
  ): Promise<ApplicationCommandRun[]> {
    return runApplicationOperation(() =>
      this.context
        .requireCommandRuns()
        .listRecent(request)
        .map((row) => ({
          id: row.id,
          commandId: row.commandId,
          ...(row.pluginId ? { pluginId: row.pluginId } : {}),
          source: row.source,
          status: row.status as CommandResult["status"],
          ...(row.inputJson ? { input: JSON.parse(row.inputJson) as JsonValue } : {}),
          ...(row.outputJson ? { output: JSON.parse(row.outputJson) as CommandResult } : {}),
          ...(row.errorJson ? { error: JSON.parse(row.errorJson) as JsonValue } : {}),
          ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
          createdAt: row.createdAt,
        })),
    );
  }
}
