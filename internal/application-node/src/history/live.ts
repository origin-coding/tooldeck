import { Effect, Layer, type Schema } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import { tryApplicationSync } from "@/application/effect";
import { History, type HistoryService } from "@/history/context";
import { classifyApplicationErrorEvidence } from "@/history/error-evidence";
import {
  CommandResultSchema,
  CommandStatusSchema,
  ListApplicationCommandRunsRequestSchema,
} from "@/history/schema";
import type { ApplicationCommandRun, ListApplicationCommandRunsRequest } from "@/history/types";
import { ApplicationStorage } from "@/storage/context";
import type { CommandRunRepository } from "@/storage/repositories";
import { decodeApplicationRequest } from "@/validation/effect-schema";
import { JsonValueSchema } from "@/validation/schemas";

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
        const decoded = yield* decodeApplicationRequest(
          ListApplicationCommandRunsRequestSchema,
          request,
          "history.listRuns",
        );
        const commandRuns = yield* getCommandRuns();
        const rows = yield* tryApplicationSync(() => commandRuns.listRecent(decoded));

        return yield* Effect.forEach(rows, (row) => formatCommandRun(row));
      }),
  });
}

function formatCommandRun(
  row: ReturnType<CommandRunRepository["listRecent"]>[number],
): ApplicationEffect<ApplicationCommandRun> {
  return Effect.gen(function* () {
    const status = yield* decodeApplicationRequest(
      CommandStatusSchema,
      row.status,
      "history.read",
      {
        errorCode: "ERR_UNKNOWN",
        message: `Stored command run ${row.id} has an invalid status.`,
        pathPrefix: ["status"],
      },
    );
    const input = row.inputJson
      ? yield* decodeStoredJson(row.inputJson, JsonValueSchema, row.id, "input")
      : undefined;
    const output = row.outputJson
      ? yield* decodeStoredJson(row.outputJson, CommandResultSchema, row.id, "output")
      : undefined;
    const error = row.errorJson
      ? yield* decodeStoredJson(row.errorJson, JsonValueSchema, row.id, "error")
      : undefined;

    return {
      id: row.id,
      commandId: row.commandId,
      ...(row.pluginId ? { pluginId: row.pluginId } : {}),
      source: row.source,
      status,
      ...(input === undefined ? {} : { input }),
      ...(output === undefined ? {} : { output }),
      ...(error === undefined
        ? {}
        : { error, errorFormat: classifyApplicationErrorEvidence(error) }),
      ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
      createdAt: row.createdAt,
    };
  });
}

function decodeStoredJson<A, I>(
  valueJson: string,
  schema: Schema.Schema<A, I, never>,
  runId: string,
  field: "input" | "output" | "error",
): ApplicationEffect<A> {
  return Effect.gen(function* () {
    const value: unknown = yield* tryApplicationSync(() => JSON.parse(valueJson));

    return yield* decodeApplicationRequest(schema, value, "history.read", {
      errorCode: "ERR_UNKNOWN",
      message: `Stored command run ${runId} has invalid ${field} data.`,
      pathPrefix: [field],
    });
  });
}
