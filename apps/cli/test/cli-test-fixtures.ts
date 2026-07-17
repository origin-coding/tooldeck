import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CommandRunRepository,
  openTooldeckDatabase,
  PreferenceRepository,
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
} from "@tooldeck/storage";
import { afterEach } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

export function createDatabasePath(): string {
  return path.join(createTempDir(), "test.sqlite");
}

export function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-cli-"));

  tempDirs.push(dir);

  return dir;
}

export function readCommandRuns(storagePath: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new CommandRunRepository(database.db);

  try {
    return repository.listRecent();
  } finally {
    database.close();
  }
}

export function readPlugins(storagePath: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PluginRepository(database.db);

  try {
    return repository.list();
  } finally {
    database.close();
  }
}

export function readPluginInstall(storagePath: string, pluginId: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PluginInstallRepository(database.db);

  try {
    return repository.getById(pluginId);
  } finally {
    database.close();
  }
}

export function readPreferenceValue(
  storagePath: string,
  scope: "desktop" | "cli" | "shared",
  key: string,
) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PreferenceRepository(database.db);

  try {
    return repository.get(scope, key);
  } finally {
    database.close();
  }
}

export function readPluginKvValue(storagePath: string, pluginId: string, key: string) {
  const database = openTooldeckDatabase({ path: storagePath });
  const repository = new PluginKvRepository(database.db);

  try {
    return repository.get(pluginId, key);
  } finally {
    database.close();
  }
}

export function writePluginKvValue(
  storagePath: string,
  pluginId: string,
  key: string,
  value: unknown,
): void {
  const database = openTooldeckDatabase({ path: storagePath });

  try {
    new PluginKvRepository(database.db).set({ pluginId, key, value });
  } finally {
    database.close();
  }
}

export function readPluginState(storagePath: string, pluginId: string) {
  const database = openTooldeckDatabase({ path: storagePath });

  try {
    return new PluginStateRepository(database.db).getById(pluginId);
  } finally {
    database.close();
  }
}

export async function createEchoPlugin(options: {
  activationMarkerPath?: string;
  commandId: string;
  pluginId: string;
  pluginRoot: string;
  responseText: string;
  version?: string;
}): Promise<void> {
  await mkdir(options.pluginRoot, { recursive: true });
  await writeFile(
    path.join(options.pluginRoot, "manifest.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      id: options.pluginId,
      name: "External Echo",
      version: options.version ?? "0.0.0",
      runtime: {
        kind: "node",
        entry: "./index.mjs",
      },
      contributes: {
        commands: [
          {
            id: options.commandId,
            title: "External Echo",
          },
        ],
      },
    }),
    "utf8",
  );
  await writeFile(
    path.join(options.pluginRoot, "index.mjs"),
    `
      ${
        options.activationMarkerPath
          ? `import { writeFile } from "node:fs/promises";
      await writeFile(${JSON.stringify(options.activationMarkerPath)}, "activated", "utf8");`
          : ""
      }
      export default {
        activate(ctx) {
          ctx.subscriptions.push(
            ctx.commands.register(${JSON.stringify(options.commandId)}, () => ({
              status: "success",
              blocks: [{ type: "text", text: ${JSON.stringify(options.responseText)} }],
            })),
          );
        },
      };
    `,
    "utf8",
  );
}
