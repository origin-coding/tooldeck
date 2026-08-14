import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Cause, Effect, Exit, Layer } from "effect";

import { applicationErrorFromCause } from "@/application/effect";
import {
  type ApplicationEffect,
  type ApplicationFailure,
  toApplicationFailure,
  tryApplicationPromise,
  tryApplicationSync,
} from "@/application/effect";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/cleanup";
import {
  type ApplicationRepositories,
  ApplicationStorage,
  type ApplicationStorageService,
} from "@/storage/context";
import {
  openTooldeckDatabase,
  type TooldeckDatabase,
  type TooldeckDatabaseOptions,
} from "@/storage/database";
import { CommandRunRepository } from "@/storage/repositories/command-runs";
import { PluginInstallRepository } from "@/storage/repositories/plugin-installs";
import { PluginKvRepository } from "@/storage/repositories/plugin-kv";
import { PluginStateRepository } from "@/storage/repositories/plugin-states";
import { PluginRepository } from "@/storage/repositories/plugins";
import { PreferenceRepository } from "@/storage/repositories/preferences";

export interface StorageLiveOptions extends TooldeckDatabaseOptions {
  readonly onCleanupFailure?: (failure: CapturedApplicationCleanupFailure) => void;
}

export function makeStorageLive(
  options: StorageLiveOptions,
): Layer.Layer<ApplicationStorage, ApplicationFailure> {
  return Layer.scoped(
    ApplicationStorage,
    Effect.acquireRelease(acquireDatabase(options), (database, exit) =>
      releaseDatabase(database, exit, options.onCleanupFailure),
    ).pipe(Effect.map(makeApplicationStorageService)),
  );
}

function acquireDatabase(options: StorageLiveOptions): ApplicationEffect<TooldeckDatabase> {
  return Effect.gen(function* () {
    yield* tryApplicationPromise(() => mkdir(path.dirname(options.path), { recursive: true }));

    return yield* tryApplicationSync(() => openTooldeckDatabase(options));
  });
}

function releaseDatabase(
  database: TooldeckDatabase,
  exit: Exit.Exit<unknown, unknown>,
  onCleanupFailure: StorageLiveOptions["onCleanupFailure"],
): Effect.Effect<void> {
  return Effect.matchEffect(
    Effect.try({
      try: () => database.close(),
      catch: (error) => error,
    }),
    {
      onFailure: (error) => {
        const failure = captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "database.close",
          context: {},
          error,
        });

        if (onCleanupFailure) {
          return Effect.sync(() => onCleanupFailure(failure));
        }

        const cleanupError = Exit.isFailure(exit)
          ? combinePrimaryAndCleanupFailures(
              applicationErrorFromCause(exit.cause as Cause.Cause<ApplicationFailure>),
              [failure],
              "Application operation failed and the database connection did not close cleanly.",
            )
          : createApplicationCleanupError("Tooldeck database connection did not close cleanly.", [
              failure,
            ]);

        return Effect.die(cleanupError);
      },
      onSuccess: () => Effect.void,
    },
  );
}

function makeApplicationStorageService(database: TooldeckDatabase): ApplicationStorageService {
  const repositories: ApplicationRepositories = Object.freeze({
    commandRuns: new CommandRunRepository(database.db),
    preferences: new PreferenceRepository(database.db),
    plugins: new PluginRepository(database.db),
    pluginInstalls: new PluginInstallRepository(database.db),
    pluginStates: new PluginStateRepository(database.db),
    pluginKv: new PluginKvRepository(database.db),
  });

  return Object.freeze({
    repositories,
    withImmediateTransaction: <A>(operation: () => A) =>
      withImmediateTransaction(database, operation),
  });
}

function withImmediateTransaction<A>(
  database: TooldeckDatabase,
  operation: () => A,
): ApplicationEffect<A> {
  return Effect.suspend(() => {
    let transactionStarted = false;

    try {
      database.sqlite.exec("begin immediate;");
      transactionStarted = true;

      const result = operation();

      database.sqlite.exec("commit;");
      transactionStarted = false;

      return Effect.succeed(result);
    } catch (error) {
      const primaryError = toApplicationFailure(error);

      if (!transactionStarted) {
        return Effect.fail(primaryError);
      }

      try {
        database.sqlite.exec("rollback;");
      } catch (rollbackError) {
        return Effect.fail(
          combinePrimaryAndCleanupFailures(
            primaryError,
            [
              captureApplicationCleanupFailure({
                phase: "rollback",
                step: "databaseTransaction.rollback",
                context: {},
                error: rollbackError,
              }),
            ],
            "Database transaction failed and rollback did not complete.",
          ),
        );
      }

      return Effect.fail(primaryError);
    }
  });
}
