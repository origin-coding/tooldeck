import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const schemaMigrations = sqliteTable("schema_migrations", {
  id: text("id").primaryKey(),
  appliedAt: integer("applied_at").notNull(),
});

export const commandRuns = sqliteTable("command_runs", {
  id: text("id").primaryKey(),
  commandId: text("command_id").notNull(),
  pluginId: text("plugin_id"),
  source: text("source").notNull(),
  status: text("status").notNull(),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  errorJson: text("error_json"),
  durationMs: integer("duration_ms"),
  createdAt: integer("created_at").notNull(),
});

export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  nameJson: text("name_json").notNull(),
  version: text("version").notNull(),
  manifestPath: text("manifest_path").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  installedAt: integer("installed_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const pluginKv = sqliteTable("plugin_kv", {
  pluginId: text("plugin_id").notNull(),
  key: text("key").notNull(),
  valueJson: text("value_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const preferences = sqliteTable(
  "preferences",
  {
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    valueJson: text("value_json").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);

export type CommandRunRow = typeof commandRuns.$inferSelect;
export type InsertCommandRunRow = typeof commandRuns.$inferInsert;
export type PluginRow = typeof plugins.$inferSelect;
export type InsertPluginRow = typeof plugins.$inferInsert;
export type PluginKvRow = typeof pluginKv.$inferSelect;
export type InsertPluginKvRow = typeof pluginKv.$inferInsert;
export type PreferenceRow = typeof preferences.$inferSelect;
export type InsertPreferenceRow = typeof preferences.$inferInsert;
