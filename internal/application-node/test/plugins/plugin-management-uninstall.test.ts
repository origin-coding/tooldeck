import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { runApplicationEffect } from "@/application/effect";
import {
  CommandRunRepository,
  PluginInstallRepository,
  PluginKvRepository,
  PluginStateRepository,
} from "@/storage";

import {
  createHarness,
  createPluginPackage,
  installPackageForTest,
} from "./plugin-management-fixtures";

describe("plugin management uninstall and purge", () => {
  it("uninstalls managed files while preserving state, KV, and command history", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.uninstall-tools";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "uninstall.run",
    });
    const installed = await installPackageForTest(harness.service, packagePath);
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
    expect(result.cleanupFailures).toEqual([]);
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

    const reinstalled = await installPackageForTest(harness.service, packagePath);

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

    await installPackageForTest(harness.service, packagePath);
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

    await expect(runApplicationEffect(harness.service.purge(pluginId))).rejects.toThrow(
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
    await expect(runApplicationEffect(harness.service.purge(pluginId))).resolves.toEqual({
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
    await expect(runApplicationEffect(harness.service.purge(pluginId))).resolves.toEqual({
      pluginId,
      stateRemoved: false,
      kvEntriesRemoved: 0,
    });
  });

  it("rolls back KV deletion when state deletion fails during purge", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.atomic-purge-tools";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "atomic-purge.run",
    });
    const states = new PluginStateRepository(harness.database.db);
    const kv = new PluginKvRepository(harness.database.db);

    await installPackageForTest(harness.service, packagePath);
    await harness.service.setEnabled(pluginId, false);
    kv.set({ pluginId, key: "first", value: 1 });
    kv.set({ pluginId, key: "second", value: 2 });
    await harness.service.uninstall(pluginId);

    harness.database.sqlite.exec(`
      create trigger fail_plugin_state_purge
      before delete on plugin_states
      when old.plugin_id = '${pluginId}'
      begin
        select raise(abort, 'forced plugin state purge failure');
      end;
    `);

    await expect(runApplicationEffect(harness.service.purge(pluginId))).rejects.toThrow(
      "forced plugin state purge failure",
    );
    expect(states.getById(pluginId)).toMatchObject({ pluginId, enabled: false });
    expect(kv.listByPlugin(pluginId)).toMatchObject([
      { pluginId, key: "first", valueJson: "1" },
      { pluginId, key: "second", valueJson: "2" },
    ]);
    expect(harness.service.listPurgeablePluginData()).toEqual([
      {
        pluginId,
        statePresent: true,
        kvEntries: 2,
      },
    ]);

    harness.database.sqlite.exec("drop trigger fail_plugin_state_purge;");

    await expect(runApplicationEffect(harness.service.purge(pluginId))).resolves.toEqual({
      pluginId,
      stateRemoved: true,
      kvEntriesRemoved: 2,
    });
  });
});
