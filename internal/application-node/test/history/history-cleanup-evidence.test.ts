import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { ApplicationHistory } from "@/history/application-history";
import { classifyApplicationErrorEvidence } from "@/history/error-evidence";
import { makeHistoryService } from "@/history/history-live";
import { CommandRunRepository, openTooldeckDatabase } from "@/storage";

import { createDatabasePath } from "../storage/storage-test-fixtures";

describe("command history cleanup evidence", () => {
  it("classifies canonical diagnostics and legacy cleanup shapes without conversion", () => {
    expect(
      classifyApplicationErrorEvidence({
        tag: "ApplicationError",
        source: "application",
        code: "ERR_UNKNOWN",
        message: "operation failed",
        details: {
          cleanupFailures: [
            {
              phase: "cleanup",
              step: "database.close",
              context: {},
              error: {
                source: "application",
                code: "ERR_UNKNOWN",
                message: "close failed",
              },
            },
          ],
        },
      }),
    ).toBe("canonical");
    expect(
      classifyApplicationErrorEvidence({
        tag: "ApplicationError",
        source: "application",
        code: "ERR_UNKNOWN",
        message: "operation failed",
        details: { cleanupFailure: { message: "legacy close failure" } },
      }),
    ).toBe("legacy");
  });

  it("returns legacy error JSON as raw evidence and leaves its SQLite bytes unchanged", async () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });
    const repository = new CommandRunRepository(database.db);
    const legacyJson =
      '{ "tag":"ApplicationError", "source":"application", "code":"ERR_UNKNOWN", "message":"legacy", "details":{"cleanupFailure":{"message":"close failed"}} }';

    try {
      database.sqlite
        .prepare(
          `insert into command_runs (
            id, command_id, plugin_id, source, status, input_json, output_json,
            error_json, duration_ms, created_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "legacy-run",
          "legacy.command",
          null,
          "test",
          "error",
          null,
          null,
          legacyJson,
          null,
          1,
        );

      const history = new ApplicationHistory(makeHistoryService(() => Effect.succeed(repository)));
      const runs = await history.listCommandRuns();

      expect(runs).toEqual([
        expect.objectContaining({
          id: "legacy-run",
          errorFormat: "legacy",
          error: {
            tag: "ApplicationError",
            source: "application",
            code: "ERR_UNKNOWN",
            message: "legacy",
            details: { cleanupFailure: { message: "close failed" } },
          },
        }),
      ]);
      expect(
        database.sqlite
          .prepare("select error_json as errorJson from command_runs where id = ?")
          .get("legacy-run"),
      ).toEqual({ errorJson: legacyJson });
    } finally {
      database.close();
    }
  });
});
