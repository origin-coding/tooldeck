import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Effect, Exit } from "effect";

import { applicationErrorFromCause, runApplicationEffect } from "@/application/edge";
import {
  tryApplicationPromise,
  tryApplicationSync,
  type ApplicationEffect,
} from "@/application/effect";
import {
  captureApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import {
  openTooldeckDatabase,
  type TooldeckDatabase,
  type TooldeckDatabaseOptions,
} from "@/storage/database";

export async function withTooldeckDatabase<TResult>(
  options: TooldeckDatabaseOptions,
  callback: (database: TooldeckDatabase) => TResult | Promise<TResult>,
): Promise<TResult> {
  return runApplicationEffect(withTooldeckDatabaseEffect(options, callback));
}

function withTooldeckDatabaseEffect<TResult>(
  options: TooldeckDatabaseOptions,
  callback: (database: TooldeckDatabase) => TResult | Promise<TResult>,
): ApplicationEffect<TResult> {
  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      yield* tryApplicationPromise(() => mkdir(path.dirname(options.path), { recursive: true }));

      const database = yield* tryApplicationSync(() => openTooldeckDatabase(options));
      const callbackExit = yield* Effect.exit(
        restore(tryApplicationPromise(async () => callback(database))),
      );
      const closeExit = yield* Effect.exit(tryApplicationSync(() => database.close()));

      if (Exit.isFailure(callbackExit)) {
        const callbackError = applicationErrorFromCause(callbackExit.cause);

        if (Exit.isFailure(closeExit)) {
          return yield* Effect.fail(
            combinePrimaryAndCleanupFailures(
              callbackError,
              [
                captureApplicationCleanupFailure({
                  phase: "cleanup",
                  step: "database.close",
                  context: {},
                  error: applicationErrorFromCause(closeExit.cause),
                }),
              ],
              "Tooldeck database callback failed and the connection did not close cleanly.",
            ),
          );
        }

        return yield* Effect.fail(callbackError);
      }

      if (Exit.isFailure(closeExit)) {
        return yield* Effect.fail(
          createApplicationCleanupError("Tooldeck database connection did not close cleanly.", [
            captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "database.close",
              context: {},
              error: applicationErrorFromCause(closeExit.cause),
            }),
          ]),
        );
      }

      return callbackExit.value;
    }),
  );
}

export async function withRepository<TRepository, TResult>(
  storagePath: string,
  createRepository: (db: TooldeckDatabase["db"]) => TRepository,
  callback: (repository: TRepository) => TResult | Promise<TResult>,
): Promise<TResult> {
  return withTooldeckDatabase({ path: storagePath }, (database) =>
    callback(createRepository(database.db)),
  );
}
