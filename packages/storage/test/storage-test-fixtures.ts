import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach } from "vitest";

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
