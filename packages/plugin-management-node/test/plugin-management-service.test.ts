import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";
import {
  CommandRunRepository,
  openTooldeckDatabase,
  PluginInstallRepository,
  PluginKvRepository,
  PluginStateRepository,
  type TooldeckDatabase,
} from "@tooldeck/storage";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PluginManagementService } from "../src";
import * as filesystem from "../src/filesystem";

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

describe("PluginManagementService", () => {
  it("syncs the plugin catalog and manages enabled state", async () => {
    const harness = await createHarness();

    await writePluginProject({
      projectDir: path.join(harness.builtinPluginsDir, "builtin-tools"),
      pluginId: "dev.tooldeck.builtin-tools",
      commandId: "builtin.run",
    });

    const catalog = await harness.service.scanAndSyncCatalog();
    const disabled = await harness.service.setEnabled("dev.tooldeck.builtin-tools", false);

    expect(catalog.plugins).toHaveLength(1);
    expect(catalog.plugins[0]).toMatchObject({
      id: "dev.tooldeck.builtin-tools",
      sourceKind: "builtin",
      enabled: true,
    });
    expect(disabled.enabled).toBe(false);
    expect(new PluginStateRepository(harness.database.db).getById(disabled.id)).toMatchObject({
      enabled: false,
    });
  });

  it("installs a valid Node package without loading its runtime entry", async () => {
    const harness = await createHarness();
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId: "dev.example.installed-tools",
      commandId: "installed.run",
      runtimeSource: 'throw new Error("runtime entry must not be imported during install");\n',
    });
    const states = new PluginStateRepository(harness.database.db);

    states.setEnabled("dev.example.installed-tools", false);

    const result = await harness.service.installPackage(packagePath);

    expect(result.plugin).toMatchObject({
      id: "dev.example.installed-tools",
      sourceKind: "installed",
      enabled: false,
    });
    expect(result.install).toMatchObject({
      pluginId: "dev.example.installed-tools",
      version: "0.1.0",
      packageName: path.basename(packagePath),
    });
    expect(result.install.packageDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(result.install.manifestPath)).toBe(true);
    expect(new PluginInstallRepository(harness.database.db).getById(result.plugin.id)).toEqual(
      result.install,
    );
  });

  it("rejects command conflicts and removes the staging directory", async () => {
    const harness = await createHarness();

    await writePluginProject({
      projectDir: path.join(harness.builtinPluginsDir, "builtin-tools"),
      pluginId: "dev.tooldeck.builtin-tools",
      commandId: "shared.run",
    });
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId: "dev.example.conflicting-tools",
      commandId: "shared.run",
    });

    await expect(harness.service.installPackage(packagePath)).rejects.toThrow(
      "Command id conflict: shared.run",
    );
    expect(
      new PluginInstallRepository(harness.database.db).getById("dev.example.conflicting-tools"),
    ).toBeUndefined();
    expect(
      existsSync(path.join(harness.installedPluginsDir, "dev.example.conflicting-tools")),
    ).toBe(false);
    expect(await readdir(path.join(harness.installedPluginsDir, ".staging"))).toEqual([]);
  });

  it("rejects non-Node packages without leaving install state", async () => {
    const harness = await createHarness();
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId: "dev.example.wasm-tools",
      commandId: "wasm.run",
      runtimeKind: "wasm",
    });

    await expect(harness.service.installPackage(packagePath)).rejects.toThrow(
      "Unsupported installed plugin runtime: wasm",
    );
    expect(
      new PluginInstallRepository(harness.database.db).getById("dev.example.wasm-tools"),
    ).toBeUndefined();
    expect(existsSync(path.join(harness.installedPluginsDir, "dev.example.wasm-tools"))).toBe(
      false,
    );
  });

  it("rolls back installed files when the install record cannot be written", async () => {
    const harness = await createHarness();
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId: "dev.example.storage-failure",
      commandId: "storage-failure.run",
    });

    harness.database.sqlite.exec(`
      create trigger fail_plugin_install
      before insert on plugin_installs
      begin
        select raise(abort, 'forced install record failure');
      end;
    `);

    await expect(harness.service.installPackage(packagePath)).rejects.toThrow(
      "forced install record failure",
    );
    expect(existsSync(path.join(harness.installedPluginsDir, "dev.example.storage-failure"))).toBe(
      false,
    );
    expect(
      new PluginInstallRepository(harness.database.db).getById("dev.example.storage-failure"),
    ).toBeUndefined();
  });

  it("uninstalls managed files while preserving state, KV, and command history", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.uninstall-tools";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "uninstall.run",
    });
    const installed = await harness.service.installPackage(packagePath);
    const states = new PluginStateRepository(harness.database.db);
    const kv = new PluginKvRepository(harness.database.db);
    const runs = new CommandRunRepository(harness.database.db);

    await harness.service.setEnabled(pluginId, false);
    kv.set({ pluginId, key: "answer", value: 42 });
    runs.create({
      id: "run-before-uninstall",
      commandId: "uninstall.run",
      pluginId,
      source: "cli",
      status: "success",
    });

    const result = await harness.service.uninstall(pluginId);
    const catalog = await harness.service.scanAndSyncCatalog();

    expect(result.filesMissing).toBe(false);
    expect(result.cleanupPending).toBe(false);
    expect(existsSync(installed.install.installDir)).toBe(false);
    expect(new PluginInstallRepository(harness.database.db).getById(pluginId)).toBeUndefined();
    expect(catalog.plugins.find((plugin) => plugin.id === pluginId)).toBeUndefined();
    expect(states.getById(pluginId)).toMatchObject({ enabled: false });
    expect(kv.get(pluginId, "answer")).toBe(42);
    expect(runs.listRecent()).toEqual([
      expect.objectContaining({
        id: "run-before-uninstall",
        pluginId,
      }),
    ]);

    const reinstalled = await harness.service.installPackage(packagePath);

    expect(reinstalled.plugin.enabled).toBe(false);
  });

  it("purges state and scoped KV only after uninstall while preserving command history", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.purge-tools";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "purge.run",
    });
    const states = new PluginStateRepository(harness.database.db);
    const kv = new PluginKvRepository(harness.database.db);
    const runs = new CommandRunRepository(harness.database.db);

    await harness.service.installPackage(packagePath);
    await harness.service.setEnabled(pluginId, false);
    kv.set({ pluginId, key: "first", value: 1 });
    kv.set({ pluginId, key: "second", value: 2 });
    runs.create({
      id: "run-before-purge",
      commandId: "purge.run",
      pluginId,
      source: "cli",
      status: "success",
    });

    expect(() => harness.service.purge(pluginId)).toThrow(
      `Plugin must be uninstalled before its local data can be purged: ${pluginId}`,
    );
    expect(states.getById(pluginId)).toMatchObject({ enabled: false });
    expect(kv.listByPlugin(pluginId)).toHaveLength(2);

    await harness.service.uninstall(pluginId);

    expect(harness.service.listPurgeablePluginData()).toEqual([
      {
        pluginId,
        statePresent: true,
        kvEntries: 2,
      },
    ]);
    expect(harness.service.purge(pluginId)).toEqual({
      pluginId,
      stateRemoved: true,
      kvEntriesRemoved: 2,
    });
    expect(states.getById(pluginId)).toBeUndefined();
    expect(kv.listByPlugin(pluginId)).toEqual([]);
    expect(runs.listRecent()).toEqual([
      expect.objectContaining({
        id: "run-before-purge",
        pluginId,
      }),
    ]);
    expect(harness.service.listPurgeablePluginData()).toEqual([]);
    expect(harness.service.purge(pluginId)).toEqual({
      pluginId,
      stateRemoved: false,
      kvEntriesRemoved: 0,
    });
  });

  it("keeps a plugin logically uninstalled when quarantine cleanup partially fails", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.cleanup-failure";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "cleanup-failure.run",
    });
    const installed = await harness.service.installPackage(packagePath);

    vi.spyOn(filesystem, "removePath").mockImplementationOnce(async (quarantineDir) => {
      await rm(path.join(quarantineDir, "dist"), { recursive: true, force: true });
      throw new Error("forced quarantine cleanup failure");
    });

    const result = await harness.service.uninstall(pluginId);
    const stagingEntries = await readdir(path.join(harness.installedPluginsDir, ".staging"));

    expect(result).toMatchObject({
      cleanupError: "forced quarantine cleanup failure",
      cleanupPending: true,
      filesMissing: false,
      pluginId,
    });
    expect(existsSync(installed.install.installDir)).toBe(false);
    expect(new PluginInstallRepository(harness.database.db).getById(pluginId)).toBeUndefined();
    expect((await harness.service.scanAndSyncCatalog()).plugins).toEqual([]);
    expect(stagingEntries).toHaveLength(1);
    expect(stagingEntries[0]).toMatch(/^uninstall-/);
  });

  it("repairs an install record when the managed directory is already missing", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.missing-files";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "missing-files.run",
    });
    const installed = await harness.service.installPackage(packagePath);

    await rm(installed.install.installDir, { recursive: true, force: true });

    const result = await harness.service.uninstall(pluginId);

    expect(result.filesMissing).toBe(true);
    expect(new PluginInstallRepository(harness.database.db).getById(pluginId)).toBeUndefined();
    expect((await harness.service.scanAndSyncCatalog()).plugins).toEqual([]);
  });

  it("never deletes an install path outside the managed plugin root", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.tampered-path";
    const outsideDir = path.join(harness.rootDir, "outside-install");

    await mkdir(outsideDir, { recursive: true });
    await writeFile(path.join(outsideDir, "keep.txt"), "keep", "utf8");
    new PluginInstallRepository(harness.database.db).create({
      pluginId,
      version: "0.1.0",
      installDir: outsideDir,
      manifestPath: path.join(outsideDir, "manifest.json"),
      packageName: "tampered.tdplugin",
      packageDigest: "digest",
      packageSizeBytes: 1,
    });

    await expect(harness.service.uninstall(pluginId)).rejects.toThrow(
      "Installed plugin path does not match its managed location",
    );
    expect(existsSync(path.join(outsideDir, "keep.txt"))).toBe(true);
    expect(new PluginInstallRepository(harness.database.db).getById(pluginId)).toBeDefined();
  });

  it("restores files and the install record when post-uninstall scanning fails", async () => {
    const rootDir = createTempDir();
    const externalDir = path.join(rootDir, "external-plugins");

    await mkdir(externalDir, { recursive: true });
    const harness = await createHarness({ rootDir, externalDir });
    const pluginId = "dev.example.rollback-uninstall";
    const packagePath = await createPluginPackage({
      rootDir,
      pluginId,
      commandId: "rollback-uninstall.run",
    });
    const installed = await harness.service.installPackage(packagePath);

    await rm(externalDir, { recursive: true, force: true });

    await expect(harness.service.uninstall(pluginId)).rejects.toThrow(
      "Plugin uninstall failed and rollback did not complete",
    );
    expect(existsSync(installed.install.installDir)).toBe(true);
    expect(new PluginInstallRepository(harness.database.db).getById(pluginId)).toEqual(
      installed.install,
    );
  });

  it("rejects uninstall for plugins without managed install records", async () => {
    const harness = await createHarness();

    await expect(harness.service.uninstall("dev.tooldeck.builtin-tools")).rejects.toThrow(
      "Plugin is not installed: dev.tooldeck.builtin-tools",
    );
  });
});

interface Harness {
  builtinPluginsDir: string;
  database: TooldeckDatabase;
  installedPluginsDir: string;
  rootDir: string;
  service: PluginManagementService;
}

async function createHarness(
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

async function createPluginPackage(options: {
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

async function writePluginProject(options: {
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

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-plugin-management-"));
  tempDirs.push(dir);
  return dir;
}
