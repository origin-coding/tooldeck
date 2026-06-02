import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openTooldeckDatabase } from "../src";
import { CommandRunRepository } from "../src";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("storage", () => {
  it("runs the initial migration", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const commandRunsTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("command_runs");
      const migration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0001_initial");

      expect(commandRunsTable).toMatchObject({ name: "command_runs" });
      expect(migration).toMatchObject({ id: "0001_initial" });
    } finally {
      database.close();
    }
  });

  it("creates and lists command runs from newest to oldest", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new CommandRunRepository(database.db);

      repository.create({
        id: "run-old",
        commandId: "json.format",
        pluginId: "dev.example.json-tools",
        source: "cli",
        status: "success",
        input: { text: '{"a":1}' },
        output: {
          status: "success",
          blocks: [{ type: "text", text: '{\n  "a": 1\n}' }],
        },
        durationMs: 12,
        createdAt: 1000,
      });
      repository.create({
        id: "run-new",
        commandId: "json.format",
        source: "desktop",
        status: "error",
        error: { message: "Invalid JSON" },
        durationMs: 3,
        createdAt: 2000,
      });

      const runs = repository.listRecent();

      expect(runs.map((run) => run.id)).toEqual(["run-new", "run-old"]);
      expect(runs[0]).toMatchObject({
        commandId: "json.format",
        pluginId: null,
        source: "desktop",
        status: "error",
        durationMs: 3,
      });
      expect(runs[0]?.errorJson).toBe(JSON.stringify({ message: "Invalid JSON" }));
      expect(runs[1]?.inputJson).toBe(JSON.stringify({ text: '{"a":1}' }));
    } finally {
      database.close();
    }
  });

  it("closes the SQLite connection", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    database.close();

    expect(() => database.sqlite.prepare("select 1")).toThrow();
  });
});

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "tooldeck-storage-"));
  tempDirs.push(dir);
  return join(dir, "test.sqlite");
}
