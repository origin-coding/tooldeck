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
  let callbackOutcome: { success: true; value: TResult } | { success: false; error: unknown };

  try {
    callbackOutcome = {
      success: true,
      value: await callback(database),
    };
  } catch (error) {
    callbackOutcome = { success: false, error };
  }

  let closeOutcome: { success: true } | { success: false; error: unknown };

  try {
    database.close();
    closeOutcome = { success: true };
  } catch (error) {
    closeOutcome = { success: false, error };
  }

  if (!callbackOutcome.success) {
    if (!closeOutcome.success) {
      throw new AggregateError(
        [callbackOutcome.error, closeOutcome.error],
        "Tooldeck database callback failed and the connection did not close cleanly.",
        { cause: callbackOutcome.error },
      );
    }

    throw callbackOutcome.error;
  }

  if (!closeOutcome.success) {
    throw closeOutcome.error;
  }

  return callbackOutcome.value;
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
