import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { openTooldeckDatabase, type TooldeckDatabase } from "@tooldeck/storage";
import { afterEach, vi } from "vitest";

import { PluginManagementService } from "../src";

const databases: TooldeckDatabase[] = [];
const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();

  for (const database of databases.splice(0)) {
    database.close();
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface Harness {
  builtinPluginsDir: string;
  database: TooldeckDatabase;
  installedPluginsDir: string;
  rootDir: string;
  service: PluginManagementService;
}

export async function createHarness(
  options: {
    rootDir?: string;
    externalDir?: string;
  } = {},
): Promise<Harness> {
  const rootDir = options.rootDir ?? createTempDir();
  const builtinPluginsDir = path.join(rootDir, "builtin-plugins");
  const installedPluginsDir = path.join(rootDir, "installed-plugins");
  const database = openTooldeckDatabase({ path: path.join(rootDir, "tooldeck.sqlite") });
  const pluginSources = [
    { kind: "builtin" as const, path: builtinPluginsDir },
    { kind: "installed" as const, path: installedPluginsDir },
    ...(options.externalDir ? [{ kind: "external" as const, path: options.externalDir }] : []),
  ];

  databases.push(database);
  await mkdir(builtinPluginsDir, { recursive: true });

  return {
    builtinPluginsDir,
    database,
    installedPluginsDir,
    rootDir,
    service: new PluginManagementService({
      database,
      installedPluginsDir,
      pluginSources,
    }),
  };
}

export async function createPluginPackage(options: {
  rootDir: string;
  pluginId: string;
  commandId: string;
  runtimeKind?: string;
  runtimeSource?: string;
}): Promise<string> {
  const projectDir = path.join(options.rootDir, `project-${options.pluginId}`);
  const packagePath = path.join(options.rootDir, `${options.pluginId}-0.1.0.tdplugin`);

  await writePluginProject({
    projectDir,
    pluginId: options.pluginId,
    commandId: options.commandId,
    runtimeKind: options.runtimeKind,
    runtimeSource: options.runtimeSource,
  });
  await packTooldeckPlugin({
    projectDir,
    outputPath: packagePath,
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
  });

  return packagePath;
}

export async function writePluginProject(options: {
  projectDir: string;
  pluginId: string;
  commandId: string;
  runtimeKind?: string;
  runtimeSource?: string;
}): Promise<void> {
  const runtimeKind = options.runtimeKind ?? "node";
  const runtimeEntry = runtimeKind === "node" ? "./dist/index.js" : "./module.wasm";

  await mkdir(path.dirname(path.join(options.projectDir, runtimeEntry)), { recursive: true });
  await writeFile(
    path.join(options.projectDir, "manifest.json"),
    JSON.stringify(
      {
        schemaVersion: "1.0",
        id: options.pluginId,
        name: options.pluginId,
        version: "0.1.0",
        runtime: {
          kind: runtimeKind,
          entry: runtimeEntry,
        },
        contributes: {
          commands: [
            {
              id: options.commandId,
              title: options.commandId,
            },
          ],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    path.join(options.projectDir, runtimeEntry),
    options.runtimeSource ?? "export default { activate() {} };\n",
    "utf8",
  );
}

export function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-management-"));
  tempDirs.push(dir);
  return dir;
}
