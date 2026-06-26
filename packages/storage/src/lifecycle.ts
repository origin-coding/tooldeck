import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  openTooldeckDatabase,
  type TooldeckDatabase,
  type TooldeckDatabaseOptions,
} from "./database";

export async function withTooldeckDatabase<TResult>(
  options: TooldeckDatabaseOptions,
  callback: (database: TooldeckDatabase) => TResult | Promise<TResult>,
): Promise<TResult> {
  await mkdir(path.dirname(options.path), { recursive: true });

  const database = openTooldeckDatabase(options);

  try {
    return await callback(database);
  } finally {
    database.close();
  }
}

export async function withRepository<TRepository, TResult>(
  storagePath: string,
  createRepository: (db: TooldeckDatabase["db"]) => TRepository,
  callback: (repository: TRepository) => TResult | Promise<TResult>,
): Promise<TResult> {
  return withTooldeckDatabase({ path: storagePath }, (database) =>
    callback(createRepository(database.db)),
  );
}
