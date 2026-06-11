import type { CommandResult } from "@tooldeck/protocol";
import { desc, eq } from "drizzle-orm";

import type { TooldeckDrizzleDatabase } from "../database";
import { commandRuns, type CommandRunRow } from "../schema";

export interface CreateCommandRunInput {
  id?: string;
  commandId: string;
  pluginId?: string;
  source: string;
  status: CommandResult["status"];
  input?: unknown;
  output?: CommandResult;
  error?: unknown;
  durationMs?: number;
  createdAt?: number;
}

export interface ListCommandRunsOptions {
  limit?: number;
  commandId?: string;
}

export class CommandRunRepository {
  constructor(private readonly db: TooldeckDrizzleDatabase) {}

  create(input: CreateCommandRunInput): CommandRunRow {
    const row = {
      id: input.id ?? crypto.randomUUID(),
      commandId: input.commandId,
      pluginId: input.pluginId ?? null,
      source: input.source,
      status: input.status,
      inputJson: stringifyJson(input.input),
      outputJson: stringifyJson(input.output),
      errorJson: stringifyJson(input.error),
      durationMs: input.durationMs ?? null,
      createdAt: input.createdAt ?? Date.now(),
    };

    this.db.insert(commandRuns).values(row).run();

    return row;
  }

  listRecent(options: ListCommandRunsOptions = {}): CommandRunRow[] {
    const limit = options.limit ?? 50;

    if (options.commandId) {
      return this.db
        .select()
        .from(commandRuns)
        .where(eq(commandRuns.commandId, options.commandId))
        .orderBy(desc(commandRuns.createdAt))
        .limit(limit)
        .all();
    }

    return this.db
      .select()
      .from(commandRuns)
      .orderBy(desc(commandRuns.createdAt))
      .limit(limit)
      .all();
  }
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}
