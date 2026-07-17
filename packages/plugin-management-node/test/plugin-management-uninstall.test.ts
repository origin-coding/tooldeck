import { existsSync } from "node:fs";

import {
  CommandRunRepository,
  PluginInstallRepository,
  PluginKvRepository,
  PluginStateRepository,
} from "@tooldeck/storage";
import { describe, expect, it } from "vitest";

import { createHarness, createPluginPackage } from "./plugin-management-fixtures";

describe("PluginManagementService uninstall and purge", () => {
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
});
