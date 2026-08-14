import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import * as filesystem from "@/plugins/management/filesystem";

import {
  createHarness,
  createPluginPackage,
  createTempDir,
  installPackageForTest,
} from "./plugin-management-fixtures";

describe("plugin management recovery and safety", () => {
  it("keeps a plugin logically uninstalled when quarantine cleanup partially fails", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.cleanup-failure";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "cleanup-failure.run",
    });
    const installed = await installPackageForTest(harness.service, packagePath);

    vi.spyOn(filesystem, "removePath").mockImplementationOnce(async (quarantineDir) => {
      await rm(path.join(quarantineDir, "dist"), { recursive: true, force: true });
      throw new Error("forced quarantine cleanup failure");
    });

    const result = await harness.service.uninstall(pluginId);
    const stagingEntries = await readdir(path.join(harness.installedPluginsDir, ".staging"));

    expect(result).toMatchObject({
      cleanupFailures: [
        {
          phase: "cleanup",
          step: "pluginQuarantine.remove",
          context: {
            pluginId,
            stagingEntry: expect.stringMatching(/^uninstall-/),
          },
          error: {
            source: "application",
            code: "ERR_UNKNOWN",
            message: "forced quarantine cleanup failure",
          },
        },
      ],
      cleanupPending: true,
      filesMissing: false,
      pluginId,
    });
    expect(existsSync(installed.install.installDir)).toBe(false);
    expect(harness.repositories.pluginInstalls.getById(pluginId)).toBeUndefined();
    expect((await harness.service.scanAndSyncCatalog()).plugins).toEqual([]);
    expect(stagingEntries).toHaveLength(1);
    expect(stagingEntries[0]).toMatch(/^uninstall-/);

    harness.service.purge(pluginId);
    expect(await readdir(path.join(harness.installedPluginsDir, ".staging"))).toEqual(
      stagingEntries,
    );
  });

  it("repairs an install record when the managed directory is already missing", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.missing-files";
    const packagePath = await createPluginPackage({
      rootDir: harness.rootDir,
      pluginId,
      commandId: "missing-files.run",
    });
    const installed = await installPackageForTest(harness.service, packagePath);

    await rm(installed.install.installDir, { recursive: true, force: true });

    const result = await harness.service.uninstall(pluginId);

    expect(result.filesMissing).toBe(true);
    expect(harness.repositories.pluginInstalls.getById(pluginId)).toBeUndefined();
    expect((await harness.service.scanAndSyncCatalog()).plugins).toEqual([]);
  });

  it("never deletes an install path outside the managed plugin root", async () => {
    const harness = await createHarness();
    const pluginId = "dev.example.tampered-path";
    const outsideDir = path.join(harness.rootDir, "outside-install");

    await mkdir(outsideDir, { recursive: true });
    await writeFile(path.join(outsideDir, "keep.txt"), "keep", "utf8");
    harness.repositories.pluginInstalls.create({
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
    expect(harness.repositories.pluginInstalls.getById(pluginId)).toBeDefined();
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
    const installed = await installPackageForTest(harness.service, packagePath);

    await rm(externalDir, { recursive: true, force: true });

    await expect(harness.service.uninstall(pluginId)).rejects.toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: expect.stringContaining("External plugin directory does not exist"),
      details: {
        cleanupFailures: [
          {
            phase: "rollback",
            step: "pluginCatalog.restore",
            context: { pluginId },
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: expect.stringContaining("External plugin directory does not exist"),
            },
          },
        ],
      },
    });
    expect(existsSync(installed.install.installDir)).toBe(true);
    expect(harness.repositories.pluginInstalls.getById(pluginId)).toEqual(installed.install);
  });

  it("records failed directory and install restoration before catalog reconciliation", async () => {
    const rootDir = createTempDir();
    const externalDir = path.join(rootDir, "external-plugins");

    await mkdir(externalDir, { recursive: true });
    const harness = await createHarness({ rootDir, externalDir });
    const pluginId = "dev.example.rollback-attempt-all";
    const packagePath = await createPluginPackage({
      rootDir,
      pluginId,
      commandId: "rollback-attempt-all.run",
    });

    await installPackageForTest(harness.service, packagePath);
    await rm(externalDir, { recursive: true, force: true });

    const originalMovePath = filesystem.movePath;
    let moveCallCount = 0;

    vi.spyOn(filesystem, "movePath").mockImplementation(async (sourcePath, destinationPath) => {
      moveCallCount += 1;

      if (moveCallCount === 2) {
        throw new Error("forced directory restore failure");
      }

      await originalMovePath(sourcePath, destinationPath);
    });
    vi.spyOn(harness.repositories.pluginInstalls, "create").mockImplementationOnce(() => {
      throw new Error("forced install restore failure");
    });

    await expect(harness.service.uninstall(pluginId)).rejects.toMatchObject({
      source: "application",
      code: "ERR_UNKNOWN",
      message: expect.stringContaining("External plugin directory does not exist"),
      details: {
        cleanupFailures: [
          {
            phase: "rollback",
            step: "pluginDirectory.restore",
            context: {
              pluginId,
              stagingEntry: expect.stringMatching(/^uninstall-/),
            },
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "forced directory restore failure",
            },
          },
          {
            phase: "rollback",
            step: "pluginInstall.restore",
            context: { pluginId },
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: "forced install restore failure",
            },
          },
          {
            phase: "rollback",
            step: "pluginCatalog.restore",
            context: { pluginId },
            error: {
              source: "application",
              code: "ERR_UNKNOWN",
              message: expect.stringContaining("External plugin directory does not exist"),
            },
          },
        ],
      },
    });
    expect(moveCallCount).toBe(2);
    expect(harness.repositories.pluginInstalls.getById(pluginId)).toBeUndefined();
  });

  it("rejects uninstall for plugins without managed install records", async () => {
    const harness = await createHarness();

    await expect(harness.service.uninstall("dev.tooldeck.builtin-tools")).rejects.toThrow(
      "Plugin is not installed: dev.tooldeck.builtin-tools",
    );
  });
});
