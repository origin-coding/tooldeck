import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openTooldeckDatabase } from "../src";
import { CommandRunRepository } from "../src";
import { PluginRepository } from "../src";

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
      const pluginsTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("plugins");
      const migration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0001_initial");
      const pluginRegistryMigration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0002_plugin_registry");

      expect(commandRunsTable).toMatchObject({ name: "command_runs" });
      expect(pluginsTable).toMatchObject({ name: "plugins" });
      expect(migration).toMatchObject({ id: "0001_initial" });
      expect(pluginRegistryMigration).toMatchObject({ id: "0002_plugin_registry" });
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

  it("upserts scanned plugins and preserves enabled state", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginRepository(database.db);

      repository.upsertScannedPlugin({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.json-tools",
          name: "JSON Tools",
          version: "0.0.1",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });
      repository.setEnabled("dev.tooldeck.json-tools", false, 1500);
      const updated = repository.upsertScannedPlugin({
        manifest: {
          schemaVersion: "1.0",
          id: "dev.tooldeck.json-tools",
          name: {
            key: "plugin.name",
            default: "JSON Tools",
          },
          version: "0.0.2",
          runtime: {
            kind: "node",
            entry: "./dist/index.js",
          },
        },
        manifestPath: "plugins/json-tools/manifest.json",
        now: 2000,
      });

      expect(updated).toMatchObject({
        id: "dev.tooldeck.json-tools",
        nameJson: JSON.stringify({
          key: "plugin.name",
          default: "JSON Tools",
        }),
        version: "0.0.2",
        manifestPath: "plugins/json-tools/manifest.json",
        enabled: false,
        installedAt: 1000,
        updatedAt: 2000,
      });
      expect(repository.listEnabled()).toHaveLength(0);
      expect(repository.list()).toHaveLength(1);
    } finally {
      database.close();
    }
  });
});

function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "tooldeck-storage-"));
  tempDirs.push(dir);
  return join(dir, "test.sqlite");
}
