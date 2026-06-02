import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export type CommandRunRow = typeof commandRuns.$inferSelect;
export type InsertCommandRunRow = typeof commandRuns.$inferInsert;
