import { mkdirSync } from "node:fs";
import path from "node:path";

import { openTooldeckDatabase, PluginRepository } from "@tooldeck/storage";
import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import {
  createDatabasePath,
  createEchoPlugin,
  createPluginManifest,
  createTempDir,
} from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService plugin sources", () => {
  it("lists and runs commands from external plugin dirs", async () => {
    const externalRoot = path.join(createTempDir(), "external-echo");
    const service = new TooldeckDesktopService({
      pluginDirs: [externalRoot],
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await createEchoPlugin({
      commandId: "external.echo",
      pluginId: "dev.tooldeck.external-echo",
      pluginRoot: externalRoot,
      responseText: "external ok",
    });
    await service.start();

    try {
      expect(service.listCommands()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
          }),
          expect.objectContaining({
            id: "external.echo",
            pluginId: "dev.tooldeck.external-echo",
          }),
        ]),
      );

      await expect(
        service.runCommand({
          commandId: "external.echo",
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "text",
            text: "external ok",
          },
        ],
      });
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "external.echo",
          pluginId: "dev.tooldeck.external-echo",
          source: "desktop",
          status: "success",
        }),
      ]);
    } finally {
      await service.dispose();
    }
  });

  it("adds the managed installed source to custom desktop plugin sources", async () => {
    const rootDir = createTempDir();
    const externalRoot = path.join(rootDir, "external-plugins");
    const installedPluginsDir = path.join(rootDir, "managed-plugins");
    const storagePath = path.join(rootDir, "tooldeck.sqlite");
    const pluginsRoot = path.resolve("../..", "plugins");

    mkdirSync(externalRoot, { recursive: true });

    const service = new TooldeckDesktopService({
      installedPluginsDir,
      pluginSources: [
        { kind: "builtin", path: pluginsRoot },
        { kind: "external", path: externalRoot },
      ],
      storagePath,
    });

    await service.start();

    try {
      expect(service.listPlugins()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
          }),
        ]),
      );
    } finally {
      await service.dispose();
    }
  });

  it("removes plugin registry rows missing from the scanned plugin directory", async () => {
    const storagePath = createDatabasePath();
    const pluginsRoot = path.join(createTempDir(), "plugins");

    mkdirSync(pluginsRoot, { recursive: true });

    const database = openTooldeckDatabase({ path: storagePath });

    try {
      new PluginRepository(database.db).upsertScannedPlugin({
        manifest: createPluginManifest("dev.tooldeck.deleted-plugin", "Deleted Plugin", "1.0.0"),
        manifestPath: path.join(pluginsRoot, "deleted-plugin", "manifest.json"),
        now: 1000,
      });
    } finally {
      database.close();
    }

    const service = new TooldeckDesktopService({
      pluginsRoot,
      storagePath,
    });

    await service.start();

    try {
      expect(service.listPlugins()).toEqual([]);
      expect(service.listCommands()).toEqual([]);
    } finally {
      await service.dispose();
    }
  });
});
