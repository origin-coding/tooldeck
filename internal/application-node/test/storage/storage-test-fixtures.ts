import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Effect } from "effect";
import { afterEach } from "vitest";

import { ApplicationStorage, type ApplicationStorageService } from "@/storage/context";
import { makeStorageLive } from "@/storage/live";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function createDatabasePath(): string {
  const dir = mkdtempSync(join(tmpdir(), "tooldeck-storage-"));
  tempDirs.push(dir);
  return join(dir, "test.sqlite");
}

export function withTestStorage<A>(
  operation: (storage: ApplicationStorageService) => A | Promise<A>,
  databasePath = createDatabasePath(),
): Promise<A> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const storage = yield* ApplicationStorage;
      return yield* Effect.promise(() => Promise.resolve(operation(storage)));
    }).pipe(Effect.provide(makeStorageLive({ path: databasePath }))),
  );
}

export function createPluginManifest(id: string, name: string, version: string) {
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
