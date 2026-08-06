import { Effect, ExecutionStrategy, Exit, Scope } from "effect";

import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
} from "@/errors/application-cleanup";
import type { TooldeckDatabase } from "@/storage";

export interface ApplicationResourceScope {
  readonly scope: Scope.CloseableScope;
  readonly cleanupFailures: CapturedApplicationCleanupFailure[];
}

export function makeApplicationResourceScope(): Effect.Effect<ApplicationResourceScope> {
  return Scope.make(ExecutionStrategy.sequential).pipe(
    Effect.map((scope) => ({ scope, cleanupFailures: [] })),
  );
}

export function addDatabaseFinalizer(
  resourceScope: ApplicationResourceScope,
  database: TooldeckDatabase,
): Effect.Effect<void> {
  return Scope.addFinalizer(
    resourceScope.scope,
    Effect.try({
      try: () => database.close(),
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          resourceScope.cleanupFailures.push(
            captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "database.close",
              context: {},
              error,
            }),
          );
        }),
      ),
    ),
  );
}

export function closeApplicationResourceScope(
  resourceScope: ApplicationResourceScope,
  exit: Exit.Exit<unknown, unknown>,
): Effect.Effect<CapturedApplicationCleanupFailure[]> {
  return Scope.close(resourceScope.scope, exit).pipe(
    Effect.andThen(Effect.sync(() => resourceScope.cleanupFailures.splice(0))),
  );
}
