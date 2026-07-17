import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { PluginInstallRepository, PluginStateRepository } from "@tooldeck/storage";
import { describe, expect, it } from "vitest";

import {
  createHarness,
  createPluginPackage,
  writePluginProject,
} from "./plugin-management-fixtures";

describe("PluginManagementService catalog and install", () => {
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
});
