import { DatabaseSync } from "node:sqlite";

import { describe, expect, it, vi } from "vitest";

import {
  openTooldeckDatabase,
  CommandRunRepository,
  PluginRepository,
  PluginStateRepository,
  PreferenceRepository,
  withRepository,
  withTooldeckDatabase,
} from "../src";
import { migrations, runMigrations } from "../src/migrations";
import { createDatabasePath } from "./storage-test-fixtures";

describe("storage migrations and lifecycle", () => {
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
      const pluginInstallsTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("plugin_installs");
      const pluginStatesTable = database.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name = ?")
        .get("plugin_states");
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
      const pluginInstallStateMigration = database.sqlite
        .prepare("select id from schema_migrations where id = ?")
        .get("0005_plugin_install_state");

      expect(commandRunsTable).toMatchObject({ name: "command_runs" });
      expect(pluginsTable).toMatchObject({ name: "plugins" });
      expect(pluginKvTable).toMatchObject({ name: "plugin_kv" });
      expect(preferencesTable).toMatchObject({ name: "preferences" });
      expect(pluginInstallsTable).toMatchObject({ name: "plugin_installs" });
      expect(pluginStatesTable).toMatchObject({ name: "plugin_states" });
      expect(migration).toMatchObject({ id: "0001_initial" });
      expect(pluginRegistryMigration).toMatchObject({ id: "0002_plugin_registry" });
      expect(pluginKvMigration).toMatchObject({ id: "0003_plugin_kv" });
      expect(preferencesMigration).toMatchObject({ id: "0004_preferences" });
      expect(pluginInstallStateMigration).toMatchObject({ id: "0005_plugin_install_state" });
    } finally {
      database.close();
    }
  });

  it("migrates legacy plugin enabled values into plugin states", () => {
    const databasePath = createDatabasePath();
    const sqlite = new DatabaseSync(databasePath);

    try {
      runMigrations(sqlite, migrations.slice(0, 4));
      sqlite
        .prepare(
          `
          insert into plugins (
            id,
            name_json,
            version,
            manifest_path,
            enabled,
            installed_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          "dev.tooldeck.disabled",
          JSON.stringify("Disabled"),
          "0.0.1",
          "plugins/disabled/manifest.json",
          0,
          1000,
          2000,
        );
    } finally {
      sqlite.close();
    }

    const database = openTooldeckDatabase({ path: databasePath });

    try {
      const plugins = new PluginRepository(database.db);
      const states = new PluginStateRepository(database.db);

      expect(states.getById("dev.tooldeck.disabled")).toMatchObject({
        pluginId: "dev.tooldeck.disabled",
        enabled: false,
        createdAt: 1000,
        updatedAt: 2000,
      });
      expect(plugins.getById("dev.tooldeck.disabled")).toMatchObject({
        id: "dev.tooldeck.disabled",
        enabled: false,
      });
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

  it("closes a partial connection when database initialization fails", () => {
    const databasePath = createDatabasePath();
    const malformed = new DatabaseSync(databasePath);

    malformed.exec("create table schema_migrations (unexpected text not null);");
    malformed.close();

    const close = vi.spyOn(DatabaseSync.prototype, "close");

    try {
      expect(() => openTooldeckDatabase({ path: databasePath })).toThrow();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      close.mockRestore();
    }
  });

  it("preserves callback and close failures", async () => {
    const callbackError = new Error("callback failed");
    const closeError = new Error("close failed");

    await expect(
      withTooldeckDatabase({ path: createDatabasePath() }, (database) => {
        const close = database.close.bind(database);
        database.close = () => {
          close();
          throw closeError;
        };

        throw callbackError;
      }),
    ).rejects.toMatchObject({
      message: "Tooldeck database callback failed and the connection did not close cleanly.",
      cause: callbackError,
      errors: [callbackError, closeError],
    });
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
});
