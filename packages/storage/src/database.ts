import { DatabaseSync } from "node:sqlite";

import { drizzle } from "drizzle-orm/node-sqlite";

import { runMigrations } from "./migrations";
import * as schema from "./schema";

export interface TooldeckDatabaseOptions {
  path: string;
  migrate?: boolean;
}

type TooldeckDrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

export interface TooldeckDatabase {
  sqlite: DatabaseSync;
  db: TooldeckDrizzleDatabase;
  close(): void;
}

export function openTooldeckDatabase(options: TooldeckDatabaseOptions): TooldeckDatabase {
  const sqlite = new DatabaseSync(options.path);

  sqlite.exec("pragma foreign_keys = on;");
  sqlite.exec("pragma journal_mode = wal;");

  if (options.migrate ?? true) {
    runMigrations(sqlite);
  }

  const db = drizzle({
    client: sqlite,
    schema,
  });

  return {
    sqlite,
    db,
    close() {
      sqlite.close();
    },
  };
}
