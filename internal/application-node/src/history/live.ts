import type { CommandResult, JsonValue } from "@tooldeck/protocol";
import { Effect, Layer } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import { tryApplicationSync } from "@/application/effect";
import { History, type HistoryService } from "@/history/context";
import { classifyApplicationErrorEvidence } from "@/history/error-evidence";
import type { ListApplicationCommandRunsRequest } from "@/history/types";
import { ApplicationStorage } from "@/storage/context";
import type { CommandRunRepository } from "@/storage/repositories";

export function makeHistoryLive(): Layer.Layer<History, never, ApplicationStorage> {
  return Layer.effect(
    History,
    Effect.gen(function* () {
      const storage = yield* ApplicationStorage;
      return makeHistoryService(() => Effect.succeed(storage.repositories.commandRuns));
    }),
  );
}

export function makeHistoryService(
  getCommandRuns: () => ApplicationEffect<Pick<CommandRunRepository, "listRecent">>,
): HistoryService {
  return Object.freeze({
    listCommandRuns: (request: ListApplicationCommandRunsRequest = {}) =>
      Effect.gen(function* () {
        const commandRuns = yield* getCommandRuns();
        return yield* tryApplicationSync(() =>
          commandRuns.listRecent(request).map((row) => {
            const error = row.errorJson ? (JSON.parse(row.errorJson) as JsonValue) : undefined;

            return {
              id: row.id,
              commandId: row.commandId,
              ...(row.pluginId ? { pluginId: row.pluginId } : {}),
              source: row.source,
              status: row.status as CommandResult["status"],
              ...(row.inputJson ? { input: JSON.parse(row.inputJson) as JsonValue } : {}),
              ...(row.outputJson ? { output: JSON.parse(row.outputJson) as CommandResult } : {}),
              ...(error === undefined
                ? {}
                : { error, errorFormat: classifyApplicationErrorEvidence(error) }),
              ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
              createdAt: row.createdAt,
            };
          }),
        );
      }),
  });
}
