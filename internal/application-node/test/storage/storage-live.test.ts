import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Cause, Effect, Exit } from "effect";
import { describe, expect, it, vi } from "vitest";

import { runApplicationEffect } from "@/application/effect";
import type { CapturedApplicationCleanupFailure } from "@/errors/cleanup";
import { ApplicationError } from "@/errors/error";
import { ApplicationStorage, type ApplicationStorageService } from "@/storage/context";
import { makeStorageLive } from "@/storage/live";

import { createDatabasePath, withTestStorage } from "./storage-test-fixtures";

describe("StorageLive", () => {
  it("owns one repository graph for the lifetime of a scoped Layer", async () => {
    const databasePath = path.join(path.dirname(createDatabasePath()), "nested", "test.sqlite");
    const close = vi.spyOn(DatabaseSync.prototype, "close");
    let preferencesAfterClose: ApplicationStorageService["repositories"]["preferences"] | undefined;

    try {
      const result = await runApplicationEffect(
        Effect.gen(function* () {
          const first = yield* ApplicationStorage;
          const second = yield* ApplicationStorage;

          preferencesAfterClose = first.repositories.preferences;
          first.repositories.preferences.set({
            scope: "cli",
            key: "theme",
            value: "system",
            now: 1000,
          });

          return {
            sameService: first === second,
            sameRepositories: first.repositories === second.repositories,
            frozenService: Object.isFrozen(first),
            frozenRepositories: Object.isFrozen(first.repositories),
            value: second.repositories.preferences.get("cli", "theme"),
          };
        }).pipe(Effect.provide(makeStorageLive({ path: databasePath }))),
      );

      expect(result).toEqual({
        sameService: true,
        sameRepositories: true,
        frozenService: true,
        frozenRepositories: true,
        value: "system",
      });
      expect(close).toHaveBeenCalledOnce();
      expect(() => preferencesAfterClose?.get("cli", "theme")).toThrow();
    } finally {
      close.mockRestore();
    }
  });

  it("commits successful immediate transactions", async () => {
    const databasePath = createDatabasePath();

    await runApplicationEffect(
      Effect.gen(function* () {
        const storage = yield* ApplicationStorage;

        return yield* storage.withImmediateTransaction(() =>
          storage.repositories.preferences.set({
            scope: "cli",
            key: "theme",
            value: "dark",
            now: 1000,
          }),
        );
      }).pipe(Effect.provide(makeStorageLive({ path: databasePath }))),
    );

    await withTestStorage(({ repositories }) => {
      expect(repositories.preferences.getRow("cli", "theme")).toMatchObject({
        scope: "cli",
        key: "theme",
        valueJson: JSON.stringify("dark"),
      });
    }, databasePath);
  });

  it("rolls back failed immediate transactions without replacing the primary failure", async () => {
    const databasePath = createDatabasePath();
    const primaryError = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "transaction operation failed",
    });

    await expect(
      runApplicationEffect(
        Effect.gen(function* () {
          const storage = yield* ApplicationStorage;

          return yield* storage.withImmediateTransaction(() => {
            storage.repositories.preferences.set({
              scope: "cli",
              key: "theme",
              value: "dark",
            });
            throw primaryError;
          });
        }).pipe(Effect.provide(makeStorageLive({ path: databasePath }))),
      ),
    ).rejects.toBe(primaryError);

    await withTestStorage(({ repositories }) => {
      expect(repositories.preferences.getRow("cli", "theme")).toBeUndefined();
    }, databasePath);
  });

  it("preserves rollback failures as structured diagnostics", async () => {
    const databasePath = createDatabasePath();
    const primaryError = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "transaction operation failed",
    });
    const rollbackError = new Error("forced transaction rollback failure");
    const originalExec = DatabaseSync.prototype.exec;
    const exec = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (
      this: DatabaseSync,
      sql: string,
    ) {
      if (sql.trim().toLowerCase() === "rollback;") {
        throw rollbackError;
      }

      return originalExec.call(this, sql);
    });

    try {
      await expect(
        runApplicationEffect(
          Effect.gen(function* () {
            const storage = yield* ApplicationStorage;

            return yield* storage.withImmediateTransaction(() => {
              throw primaryError;
            });
          }).pipe(Effect.provide(makeStorageLive({ path: databasePath }))),
        ),
      ).rejects.toMatchObject({
        source: "application",
        code: "ERR_INVALID_ARGUMENT",
        message: "transaction operation failed",
        details: {
          cleanupFailures: [
            {
              phase: "rollback",
              step: "databaseTransaction.rollback",
              context: {},
              error: {
                source: "application",
                code: "ERR_UNKNOWN",
                message: "forced transaction rollback failure",
              },
            },
          ],
        },
        cause: {
          message: "Database transaction failed and rollback did not complete.",
          errors: [primaryError, rollbackError],
        },
      });
    } finally {
      exec.mockRestore();
    }
  });

  it("reports close failures through the Layer cleanup sink", async () => {
    const cleanupFailures: CapturedApplicationCleanupFailure[] = [];
    const originalClose = DatabaseSync.prototype.close;
    const closeError = new Error("forced StorageLive close failure");
    const close = vi
      .spyOn(DatabaseSync.prototype, "close")
      .mockImplementation(function (this: DatabaseSync) {
        originalClose.call(this);
        throw closeError;
      });

    try {
      await expect(
        runApplicationEffect(
          Effect.gen(function* () {
            yield* ApplicationStorage;
          }).pipe(
            Effect.provide(
              makeStorageLive({
                path: createDatabasePath(),
                onCleanupFailure: (failure) => cleanupFailures.push(failure),
              }),
            ),
          ),
        ),
      ).resolves.toBeUndefined();
      expect(cleanupFailures.map((failure) => failure.diagnostic)).toEqual([
        {
          phase: "cleanup",
          step: "database.close",
          context: {},
          error: {
            source: "application",
            code: "ERR_UNKNOWN",
            message: "forced StorageLive close failure",
          },
        },
      ]);
    } finally {
      close.mockRestore();
    }
  });

  it("does not swallow close failures when no cleanup sink is provided", async () => {
    const originalClose = DatabaseSync.prototype.close;
    const close = vi
      .spyOn(DatabaseSync.prototype, "close")
      .mockImplementation(function (this: DatabaseSync) {
        originalClose.call(this);
        throw new Error("forced unhandled StorageLive close failure");
      });

    try {
      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          yield* ApplicationStorage;
        }).pipe(Effect.provide(makeStorageLive({ path: createDatabasePath() }))),
      );

      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit)) {
        expect(Array.from(Cause.defects(exit.cause))).toEqual([
          expect.objectContaining({
            source: "application",
            code: "ERR_UNKNOWN",
            message: "Tooldeck database connection did not close cleanly.",
            details: {
              cleanupFailures: [
                {
                  phase: "cleanup",
                  step: "database.close",
                  context: {},
                  error: {
                    source: "application",
                    code: "ERR_UNKNOWN",
                    message: "forced unhandled StorageLive close failure",
                  },
                },
              ],
            },
          }),
        ]);
      }
    } finally {
      close.mockRestore();
    }
  });

  it("preserves the primary failure when scoped database cleanup also fails", async () => {
    const primaryError = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "storage operation failed",
    });
    const closeError = new Error("forced close failure after primary failure");
    const originalClose = DatabaseSync.prototype.close;
    const close = vi
      .spyOn(DatabaseSync.prototype, "close")
      .mockImplementation(function (this: DatabaseSync) {
        originalClose.call(this);
        throw closeError;
      });

    try {
      const exit = await Effect.runPromiseExit(
        Effect.gen(function* () {
          yield* ApplicationStorage;
          return yield* Effect.fail(primaryError);
        }).pipe(Effect.provide(makeStorageLive({ path: createDatabasePath() }))),
      );

      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit)) {
        expect(Array.from(Cause.failures(exit.cause))).toEqual([primaryError]);
        expect(Array.from(Cause.defects(exit.cause))).toEqual([
          expect.objectContaining({
            source: "application",
            code: "ERR_INVALID_ARGUMENT",
            message: "storage operation failed",
            details: {
              cleanupFailures: [
                {
                  phase: "cleanup",
                  step: "database.close",
                  context: {},
                  error: {
                    source: "application",
                    code: "ERR_UNKNOWN",
                    message: "forced close failure after primary failure",
                  },
                },
              ],
            },
            cause: expect.objectContaining({
              message:
                "Application operation failed and the database connection did not close cleanly.",
              errors: [primaryError, closeError],
            }),
          }),
        ]);
      }
    } finally {
      close.mockRestore();
    }
  });
});
