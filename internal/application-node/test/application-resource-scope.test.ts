import { Effect, ExecutionStrategy, Exit, Scope } from "effect";
import { describe, expect, it } from "vitest";

import {
  addDatabaseFinalizer,
  closeApplicationResourceScope,
  makeApplicationResourceScope,
} from "@/application/resource-scope";
import type { TooldeckDatabase } from "@/storage";

describe("ApplicationResourceScope", () => {
  it("closes child runtime resources before the database", async () => {
    const calls: string[] = [];
    const resourceScope = await Effect.runPromise(makeApplicationResourceScope());
    const database = createDatabase(() => {
      calls.push("database");
    });

    await Effect.runPromise(addDatabaseFinalizer(resourceScope, database));

    const runtimeScope = await Effect.runPromise(
      Scope.fork(resourceScope.scope, ExecutionStrategy.sequential),
    );
    await Effect.runPromise(
      Scope.addFinalizer(
        runtimeScope,
        Effect.sync(() => {
          calls.push("runtime");
        }),
      ),
    );

    const cleanupFailures = await Effect.runPromise(
      closeApplicationResourceScope(resourceScope, Exit.succeed(undefined)),
    );

    expect(calls).toEqual(["runtime", "database"]);
    expect(cleanupFailures).toEqual([]);
  });

  it("captures database finalizer failures as application cleanup evidence", async () => {
    const closeError = new Error("database close failed");
    const resourceScope = await Effect.runPromise(makeApplicationResourceScope());

    await Effect.runPromise(
      addDatabaseFinalizer(
        resourceScope,
        createDatabase(() => {
          throw closeError;
        }),
      ),
    );

    const cleanupFailures = await Effect.runPromise(
      closeApplicationResourceScope(resourceScope, Exit.succeed(undefined)),
    );

    expect(cleanupFailures).toEqual([
      {
        diagnostic: {
          phase: "cleanup",
          step: "database.close",
          context: {},
          error: {
            source: "application",
            code: "ERR_UNKNOWN",
            message: "database close failed",
          },
        },
        rawError: closeError,
      },
    ]);
  });
});

function createDatabase(close: () => void): TooldeckDatabase {
  return { close } as TooldeckDatabase;
}
