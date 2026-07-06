// noinspection SqlNoDataSourceInspection

import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: "0001_initial",
    sql: `
      create table if not exists schema_migrations (
        id text primary key,
        applied_at integer not null
      );

      create table if not exists command_runs (
        id text primary key,
        command_id text not null,
        plugin_id text,
        source text not null,
        status text not null,
        input_json text,
        output_json text,
        error_json text,
        duration_ms integer,
        created_at integer not null
      );

      create index if not exists command_runs_created_at_idx
        on command_runs(created_at);

      create index if not exists command_runs_command_id_idx
        on command_runs(command_id);
    `,
  },
  {
    id: "0002_plugin_registry",
    sql: `
      create table if not exists plugins (
        id text primary key,
        name_json text not null,
        version text not null,
        manifest_path text not null,
        enabled integer not null default 1,
        installed_at integer not null,
        updated_at integer not null
      );

      create index if not exists plugins_enabled_idx
        on plugins(enabled);
    `,
  },
  {
    id: "0003_plugin_kv",
    sql: `
      create table if not exists plugin_kv (
        plugin_id text not null,
        key text not null,
        value_json text not null,
        updated_at integer not null,
        primary key(plugin_id, key)
      );

      create index if not exists plugin_kv_plugin_id_idx
        on plugin_kv(plugin_id);
    `,
  },
  {
    id: "0004_preferences",
    sql: `
      create table if not exists preferences (
        scope text not null,
        key text not null,
        value_json text not null,
        updated_at integer not null,
        primary key(scope, key)
      );

      create index if not exists preferences_scope_idx
        on preferences(scope);
    `,
  },
  {
    id: "0005_plugin_install_state",
    sql: `
      alter table plugins
        add column source_kind text not null default 'builtin';

      alter table plugins
        add column install_dir text;

      create table if not exists plugin_installs (
        plugin_id text primary key,
        version text not null,
        install_dir text not null,
        manifest_path text not null,
        package_name text not null,
        package_digest text not null,
        package_size_bytes integer not null,
        installed_at integer not null,
        updated_at integer not null
      );

      create table if not exists plugin_states (
        plugin_id text primary key,
        enabled integer not null default 1,
        created_at integer not null,
        updated_at integer not null
      );

      insert or ignore into plugin_states (plugin_id, enabled, created_at, updated_at)
      select id, enabled, installed_at, updated_at
      from plugins;

      create index if not exists plugins_source_kind_idx
        on plugins(source_kind);

      create index if not exists plugin_installs_install_dir_idx
        on plugin_installs(install_dir);

      create index if not exists plugin_states_enabled_idx
        on plugin_states(enabled);
    `,
  },
];

export function runMigrations(sqlite: DatabaseSync, migrationList = migrations): void {
  sqlite.exec(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at integer not null
    );
  `);

  const hasMigration = sqlite.prepare("select 1 from schema_migrations where id = ?");
  const recordMigration = sqlite.prepare(
    "insert into schema_migrations (id, applied_at) values (?, ?)",
  );

  sqlite.exec("begin immediate;");

  try {
    for (const migration of migrationList) {
      const existing = hasMigration.get(migration.id);

      if (existing) {
        continue;
      }

      sqlite.exec(migration.sql);
      recordMigration.run(migration.id, Date.now());
    }

    sqlite.exec("commit;");
  } catch (error) {
    sqlite.exec("rollback;");
    throw error;
  }
}
