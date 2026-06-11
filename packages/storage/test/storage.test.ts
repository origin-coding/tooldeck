import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { openTooldeckDatabase, type PreferenceRow } from "../src";
import { CommandRunRepository } from "../src";
import { PluginKvRepository } from "../src";
import { PluginRepository } from "../src";
import { PreferenceRepository } from "../src";
import { withRepository, withTooldeckDatabase } from "../src";

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
      const pluginKvTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("plugin_kv");
      const preferencesTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("preferences");
      const migration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0001_initial");
      const pluginRegistryMigration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0002_plugin_registry");
      const pluginKvMigration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0003_plugin_kv");
      const preferencesMigration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0004_preferences");

      expect(commandRunsTable).toMatchObject({ name: "command_runs" });
      expect(pluginsTable).toMatchObject({ name: "plugins" });
      expect(pluginKvTable).toMatchObject({ name: "plugin_kv" });
      expect(preferencesTable).toMatchObject({ name: "preferences" });
      expect(migration).toMatchObject({ id: "0001_initial" });
      expect(pluginRegistryMigration).toMatchObject({ id: "0002_plugin_registry" });
      expect(pluginKvMigration).toMatchObject({ id: "0003_plugin_kv" });
      expect(preferencesMigration).toMatchObject({ id: "0004_preferences" });
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

  it("filters recent command runs by command id", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new CommandRunRepository(database.db);

      repository.create({
        id: "format-old",
        commandId: "json.format",
        source: "desktop",
        status: "success",
        createdAt: 1000,
      });
      repository.create({
        id: "validate-new",
        commandId: "json.validate",
        source: "desktop",
        status: "success",
        createdAt: 3000,
      });
      repository.create({
        id: "format-new",
        commandId: "json.format",
        source: "desktop",
        status: "error",
        createdAt: 2000,
      });

      const runs = repository.listRecent({ commandId: "json.format" });

      expect(runs.map((run) => run.id)).toEqual(["format-new", "format-old"]);
    } finally {
      database.close();
    }
  });

  it("closes the SQLite connection", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    database.close();

    expect(() => database.sqlite.prepare("select 1")).toThrow();
  });

  it("runs callbacks with a managed database lifecycle", async () => {
    let databaseFromCallback: ReturnType<typeof openTooldeckDatabase> | undefined;

    const result = await withTooldeckDatabase({ path: createDatabasePath() }, (database) => {
      databaseFromCallback = database;

      return database.sqlite.prepare("select 1 as value").get();
    });

    expect(result).toMatchObject({ value: 1 });
    expect(() => databaseFromCallback?.sqlite.prepare("select 1")).toThrow();
  });

  it("runs callbacks with a managed repository lifecycle", async () => {
    const storagePath = createDatabasePath();

    await withRepository(
      storagePath,
      (db) => new PreferenceRepository(db),
      (repository) =>
        repository.set({
          scope: "cli",
          key: "theme",
          value: "system",
          now: 1000,
        }),
    );

    const value = await withRepository(
      storagePath,
      (db) => new PreferenceRepository(db),
      (repository) => repository.get("cli", "theme"),
    );

    expect(value).toBe("system");
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

  it("syncs scanned plugins without deleting previously registered plugins", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginRepository(database.db);

      repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.old-plugin", "Old Plugin", "0.0.1"),
        manifestPath: "plugins/old-plugin/manifest.json",
        now: 1000,
      });
      repository.setEnabled("dev.tooldeck.old-plugin", false, 1100);

      const synced = repository.syncScannedPlugins({
        now: 2000,
        plugins: [
          {
            manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
            manifestPath: "plugins/json-tools/manifest.json",
          },
          {
            manifest: createPluginManifest("dev.tooldeck.hello-world", "Hello World", "0.0.1"),
            manifestPath: "plugins/hello-world/manifest.json",
          },
        ],
      });

      expect(synced.map((plugin) => plugin.id)).toEqual([
        "dev.tooldeck.json-tools",
        "dev.tooldeck.hello-world",
      ]);
      expect(repository.list().map((plugin) => plugin.id)).toEqual([
        "dev.tooldeck.hello-world",
        "dev.tooldeck.json-tools",
        "dev.tooldeck.old-plugin",
      ]);
      expect(repository.getById("dev.tooldeck.old-plugin")).toMatchObject({
        enabled: false,
        installedAt: 1000,
        updatedAt: 1100,
      });
    } finally {
      database.close();
    }
  });

  it("updates plugin enabled state by id", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginRepository(database.db);

      repository.upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.json-tools", "JSON Tools", "0.0.1"),
        manifestPath: "plugins/json-tools/manifest.json",
        now: 1000,
      });

      expect(repository.setEnabled("dev.tooldeck.json-tools", false, 2000)).toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: false,
        installedAt: 1000,
        updatedAt: 2000,
      });
      expect(repository.setEnabled("dev.tooldeck.missing", true, 3000)).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it("stores plugin KV values scoped by plugin id", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginKvRepository(database.db);

      repository.set({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        value: 2,
        now: 1000,
      });
      repository.set({
        pluginId: "dev.tooldeck.other",
        key: "indent",
        value: 4,
        now: 1000,
      });
      const updated = repository.set({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        value: {
          size: 8,
        },
        now: 2000,
      });

      expect(repository.get("dev.tooldeck.json-tools", "indent")).toEqual({ size: 8 });
      expect(repository.get("dev.tooldeck.other", "indent")).toBe(4);
      expect(updated).toMatchObject({
        pluginId: "dev.tooldeck.json-tools",
        key: "indent",
        valueJson: JSON.stringify({ size: 8 }),
        updatedAt: 2000,
      });

      repository.delete("dev.tooldeck.json-tools", "indent");

      expect(repository.get("dev.tooldeck.json-tools", "indent")).toBeUndefined();
      expect(repository.get("dev.tooldeck.other", "indent")).toBe(4);
    } finally {
      database.close();
    }
  });

  it("rejects plugin KV values that are not JSON serializable", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PluginKvRepository(database.db);

      expect(() =>
        repository.set({
          pluginId: "dev.tooldeck.json-tools",
          key: "invalid",
          value: undefined,
        }),
      ).toThrow("Plugin KV value must be JSON serializable");
    } finally {
      database.close();
    }
  });

  it("stores preferences scoped by app or shared namespace", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      repository.set({
        scope: "desktop",
        key: "theme",
        value: "system",
        now: 1000,
      });
      repository.set({
        scope: "cli",
        key: "theme",
        value: "dark",
        now: 1000,
      });
      const updated = repository.set({
        scope: "desktop",
        key: "theme",
        value: "light",
        now: 2000,
      });

      expect(repository.get("desktop", "theme")).toBe("light");
      expect(repository.get("cli", "theme")).toBe("dark");
      expect(repository.get("shared", "theme")).toBeUndefined();
      expect(updated).toMatchObject({
        scope: "desktop",
        key: "theme",
        valueJson: JSON.stringify("light"),
        updatedAt: 2000,
      });
      expect(repository.list("desktop").map((row: PreferenceRow) => row.key)).toEqual(["theme"]);
    } finally {
      database.close();
    }
  });

  it("deletes preferences by scope and key", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      repository.set({
        scope: "desktop",
        key: "sidebarCollapsed",
        value: true,
      });
      repository.delete("desktop", "sidebarCollapsed");

      expect(repository.get("desktop", "sidebarCollapsed")).toBeUndefined();
    } finally {
      database.close();
    }
  });

  it("rejects preferences that are not JSON serializable", () => {
    const database = openTooldeckDatabase({ path: createDatabasePath() });

    try {
      const repository = new PreferenceRepository(database.db);

      expect(() =>
        repository.set({
          scope: "desktop",
          key: "invalid",
          value: undefined,
        }),
      ).toThrow("Preference value must be JSON serializable");
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

function createPluginManifest(id: string, name: string, version: string) {
  return {
    schemaVersion: "1.0" as const,
    id,
    name,
    version,
    runtime: {
      kind: "node" as const,
      entry: "./dist/index.js",
    },
  };
}
