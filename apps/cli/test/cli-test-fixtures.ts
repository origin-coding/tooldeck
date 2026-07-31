import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach } from "vitest";

const tempDirs: string[] = [];

interface CommandRunRow {
  id: string;
  commandId: string;
  pluginId: string | null;
  source: string;
  status: string;
  inputJson: string | null;
  outputJson: string | null;
  errorJson: string | null;
  durationMs: number | null;
  createdAt: number;
}

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

export function readCommandRuns(storagePath: string): CommandRunRow[] {
  return withDatabase(
    storagePath,
    (database) =>
      database
        .prepare(
          `select id, command_id commandId, plugin_id pluginId, source, status,
            input_json inputJson, output_json outputJson, error_json errorJson,
            duration_ms durationMs, created_at createdAt
          from command_runs order by created_at desc`,
        )
        .all() as unknown as CommandRunRow[],
  );
}

export function readPlugins(storagePath: string): Array<{ id: string; enabled: boolean }> {
  return withDatabase(storagePath, (database) =>
    database
      .prepare("select id, enabled from plugins order by id")
      .all()
      .map((row) => ({
        id: String(row.id),
        enabled: Boolean(row.enabled),
      })),
  );
}

export function readPluginInstall(
  storagePath: string,
  pluginId: string,
):
  | {
      pluginId: string;
      version: string;
      installDir: string;
    }
  | undefined {
  return withDatabase(
    storagePath,
    (database) =>
      database
        .prepare(
          `select plugin_id pluginId, version, install_dir installDir
          from plugin_installs where plugin_id = ?`,
        )
        .get(pluginId) as ReturnType<typeof readPluginInstall>,
  );
}

export function readPreferenceValue(
  storagePath: string,
  scope: "desktop" | "cli" | "shared",
  key: string,
) {
  return withDatabase(storagePath, (database) => {
    const row = database
      .prepare("select value_json as valueJson from preferences where scope = ? and key = ?")
      .get(scope, key) as { valueJson: string } | undefined;

    return row ? JSON.parse(row.valueJson) : undefined;
  });
}

export function readPluginKvValue(storagePath: string, pluginId: string, key: string) {
  return withDatabase(storagePath, (database) => {
    const row = database
      .prepare("select value_json as valueJson from plugin_kv where plugin_id = ? and key = ?")
      .get(pluginId, key) as { valueJson: string } | undefined;

    return row ? JSON.parse(row.valueJson) : undefined;
  });
}

export function writePluginKvValue(
  storagePath: string,
  pluginId: string,
  key: string,
  value: unknown,
): void {
  withDatabase(storagePath, (database) => {
    database
      .prepare(
        `insert into plugin_kv (plugin_id, key, value_json, updated_at)
        values (?, ?, ?, ?)
        on conflict (plugin_id, key)
        do update set value_json = excluded.value_json, updated_at = excluded.updated_at`,
      )
      .run(pluginId, key, JSON.stringify(value), Date.now());
  });
}

export function readPluginState(
  storagePath: string,
  pluginId: string,
): { enabled: boolean } | undefined {
  return withDatabase(storagePath, (database) => {
    const row = database
      .prepare("select enabled from plugin_states where plugin_id = ?")
      .get(pluginId);

    return row ? { enabled: Boolean(row.enabled) } : undefined;
  });
}

function withDatabase<TResult>(
  storagePath: string,
  callback: (database: DatabaseSync) => TResult,
): TResult {
  const database = new DatabaseSync(storagePath);

  try {
    return callback(database);
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
