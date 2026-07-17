import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { openTooldeckDatabase, PluginKvRepository, PluginStateRepository } from "@tooldeck/storage";
import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import { createInstallablePluginPackage, createTempDir } from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService managed plugins", () => {
  it("installs, runs, uninstalls, and purges a managed plugin", async () => {
    const rootDir = createTempDir();
    const pluginsRoot = path.join(rootDir, "builtin-plugins");
    const installedPluginsDir = path.join(rootDir, "installed-plugins");
    const storagePath = path.join(rootDir, "tooldeck.sqlite");
    const activationMarkerPath = path.join(rootDir, "installed-plugin-activated.txt");
    const packagePath = await createInstallablePluginPackage({
      rootDir,
      activationMarkerPath,
      commandId: "installed.echo",
      pluginId: "dev.example.desktop-installed",
    });
    const service = new TooldeckDesktopService({
      installedPluginsDir,
      pluginsRoot,
      storagePath,
    });

    mkdirSync(pluginsRoot, { recursive: true });
    await service.start();

    try {
      const installed = await service.installPluginPackage({
        packagePath,
        locale: "en-US",
      });

      expect(installed).toMatchObject({
        status: "installed",
        installedPluginId: "dev.example.desktop-installed",
        packageName: path.basename(packagePath),
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dev.example.desktop-installed",
            sourceKind: "installed",
            runtimeState: "inactive",
          }),
        ]),
        commands: expect.arrayContaining([
          expect.objectContaining({
            id: "installed.echo",
            pluginId: "dev.example.desktop-installed",
          }),
        ]),
      });
      expect(existsSync(activationMarkerPath)).toBe(false);

      await expect(
        service.runCommand({
          commandId: "installed.echo",
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [{ type: "text", text: "installed ok" }],
      });
      expect(existsSync(activationMarkerPath)).toBe(true);
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "installed.echo",
          pluginId: "dev.example.desktop-installed",
          source: "desktop",
          status: "success",
        }),
      ]);

      const dataDatabase = openTooldeckDatabase({ path: storagePath });

      try {
        new PluginKvRepository(dataDatabase.db).set({
          pluginId: "dev.example.desktop-installed",
          key: "retained",
          value: true,
        });
      } finally {
        dataDatabase.close();
      }

      await expect(
        service.uninstallPlugin({
          pluginId: "dev.example.desktop-installed",
          locale: "en-US",
        }),
      ).resolves.toMatchObject({
        cleanupPending: false,
        pluginId: "dev.example.desktop-installed",
        plugins: expect.not.arrayContaining([
          expect.objectContaining({ id: "dev.example.desktop-installed" }),
        ]),
        residues: [
          {
            pluginId: "dev.example.desktop-installed",
            statePresent: true,
            kvEntries: 1,
          },
        ],
      });

      expect(service.purgePluginData({ pluginId: "dev.example.desktop-installed" })).toMatchObject({
        pluginId: "dev.example.desktop-installed",
        stateRemoved: true,
        kvEntriesRemoved: 1,
        residues: [],
      });
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "installed.echo",
          pluginId: "dev.example.desktop-installed",
        }),
      ]);

      const verifiedDatabase = openTooldeckDatabase({ path: storagePath });

      try {
        expect(
          new PluginStateRepository(verifiedDatabase.db).getById("dev.example.desktop-installed"),
        ).toBeUndefined();
        expect(
          new PluginKvRepository(verifiedDatabase.db).listByPlugin("dev.example.desktop-installed"),
        ).toEqual([]);
      } finally {
        verifiedDatabase.close();
      }
    } finally {
      await service.dispose();
    }
  });
});
