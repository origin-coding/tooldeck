import type { ApplicationCommandRun } from "@tooldeck/application-node";

import type { CommandRunRecord } from "@/shared/api";

export function toDesktopCommandRun(run: ApplicationCommandRun): CommandRunRecord {
  return {
    id: run.id,
    commandId: run.commandId,
    ...(run.pluginId ? { pluginId: run.pluginId } : {}),
    source: run.source,
    status: run.status,
    ...(run.input === undefined ? {} : { input: run.input }),
    ...(run.output === undefined ? {} : { output: run.output }),
    ...(run.error === undefined ? {} : { error: run.error }),
    ...(run.errorFormat === undefined ? {} : { errorFormat: run.errorFormat }),
    ...(run.durationMs === undefined ? {} : { durationMs: run.durationMs }),
    createdAt: run.createdAt,
  };
}
