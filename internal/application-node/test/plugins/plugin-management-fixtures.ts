import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import { Context, Effect, ExecutionStrategy, Exit, Layer, Scope } from "effect";
import { afterEach, vi } from "vitest";

import { type ApplicationEffect, runApplicationEffect } from "@/application/effect";
import {
  installPluginPackage,
  listPurgeablePluginData,
  makePluginManagementContext,
  purgePluginData,
  scanAndSyncPluginCatalog,
  setManagedPluginEnabled,
  uninstallPlugin,
  type InstalledPluginSummary,
  type PluginCatalogSnapshot,
  type PurgeablePluginDataSummary,
  type PurgedPluginSummary,
  type UninstalledPluginSummary,
} from "@/plugins/management";
import type { PluginRow } from "@/storage";
import { type ApplicationRepositories, ApplicationStorage } from "@/storage/context";
import { makeStorageLive } from "@/storage/live";

const scopes: Scope.CloseableScope[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();

  for (const scope of scopes.splice(0)) {
    await Effect.runPromise(Scope.close(scope, Exit.succeed(undefined)));
  }

  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

interface Harness {
  builtinPluginsDir: string;
  executeSql(sql: string): void;
  installedPluginsDir: string;
  repositories: ApplicationRepositories;
  rootDir: string;
  service: PluginManagementTestService;
}

interface PluginManagementTestService {
  scanAndSyncCatalog(): Promise<PluginCatalogSnapshot>;
  setEnabled(pluginId: string, enabled: boolean): Promise<PluginRow>;
  installPackage(packagePath: string): ApplicationEffect<InstalledPluginSummary>;
  uninstall(pluginId: string): Promise<UninstalledPluginSummary>;
  listPurgeablePluginData(): PurgeablePluginDataSummary[];
  purge(pluginId: string): ApplicationEffect<PurgedPluginSummary>;
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
  const databasePath = path.join(rootDir, "tooldeck.sqlite");
  const pluginSources = [
    { kind: "builtin" as const, path: builtinPluginsDir },
    { kind: "installed" as const, path: installedPluginsDir },
    ...(options.externalDir ? [{ kind: "external" as const, path: options.externalDir }] : []),
  ];

  await mkdir(builtinPluginsDir, { recursive: true });
  const scope = Effect.runSync(Scope.make(ExecutionStrategy.sequential));
  scopes.push(scope);
  const storageContext = await runApplicationEffect(
    Layer.buildWithScope(makeStorageLive({ path: databasePath }), scope),
  );
  const storage = Context.get(storageContext, ApplicationStorage);
  const management = makePluginManagementContext({
    installedPluginsDir,
    pluginSources,
    repositories: storage.repositories,
    withImmediateTransaction: storage.withImmediateTransaction,
  });

  return {
    builtinPluginsDir,
    executeSql: (sql) => executeSql(databasePath, sql),
    installedPluginsDir,
    repositories: storage.repositories,
    rootDir,
    service: {
      scanAndSyncCatalog: () => runApplicationEffect(scanAndSyncPluginCatalog(management)),
      setEnabled: (pluginId, enabled) =>
        runApplicationEffect(setManagedPluginEnabled(management, pluginId, enabled)),
      installPackage: (packagePath) => installPluginPackage(management, packagePath),
      uninstall: (pluginId) => runApplicationEffect(uninstallPlugin(management, pluginId)),
      listPurgeablePluginData: () => Effect.runSync(listPurgeablePluginData(management)),
      purge: (pluginId) => purgePluginData(management, pluginId),
    },
  };
}

function executeSql(databasePath: string, sql: string): void {
  const sqlite = new DatabaseSync(databasePath);

  try {
    sqlite.exec(sql);
  } finally {
    sqlite.close();
  }
}

export function installPackageForTest(service: PluginManagementTestService, packagePath: string) {
  return runApplicationEffect(service.installPackage(packagePath));
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
