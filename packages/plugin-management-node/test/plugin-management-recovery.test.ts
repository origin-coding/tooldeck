import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { PluginInstallRepository } from "@tooldeck/storage";
import { describe, expect, it, vi } from "vitest";

import * as filesystem from "../src/filesystem";
import { createHarness, createPluginPackage, createTempDir } from "./plugin-management-fixtures";

describe("PluginManagementService recovery and safety", () => {
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
