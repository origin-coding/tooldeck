import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "./tooldeck-service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("TooldeckDesktopService", () => {
  it("lists commands, runs json.format, and records desktop history", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      const commands = service.listCommands();
      const plugins = service.listPlugins();

      expect(commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
            pluginEnabled: true,
            pluginRuntimeState: "inactive",
            title: "Format JSON",
          }),
        ]),
      );
      expect(plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            enabled: true,
            runtimeState: "inactive",
            commandCount: expect.any(Number),
          }),
        ]),
      );

      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).resolves.toEqual({
        status: "success",
        blocks: [
          {
            type: "code",
            text: '{\n  "a": 1\n}',
            language: "json",
          },
        ],
      });
      expect(service.listPlugins()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            enabled: true,
            runtimeState: "active",
          }),
        ]),
      );

      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "json.format",
          pluginId: "dev.tooldeck.json-tools",
          source: "desktop",
          status: "success",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
          output: {
            status: "success",
            blocks: [
              {
                type: "code",
                text: '{\n  "a": 1\n}',
                language: "json",
              },
            ],
          },
          durationMs: expect.any(Number),
          createdAt: expect.any(Number),
        }),
      ]);
    } finally {
      await service.dispose();
    }
  });

  it("persists plugin enabled state and blocks disabled desktop commands", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      await expect(
        service.setPluginEnabled({
          pluginId: "dev.tooldeck.json-tools",
          enabled: false,
        }),
      ).resolves.toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: false,
        runtimeState: "inactive",
      });

      expect(service.listCommands()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginEnabled: false,
          }),
        ]),
      );
      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).rejects.toThrow("Plugin is disabled for command json.format: dev.tooldeck.json-tools");
      expect(service.listCommandRuns()).toEqual([
        expect.objectContaining({
          commandId: "json.format",
          pluginId: "dev.tooldeck.json-tools",
          source: "desktop",
          status: "error",
          error: expect.objectContaining({
            message: "Plugin is disabled for command json.format: dev.tooldeck.json-tools",
          }),
        }),
      ]);

      await expect(
        service.setPluginEnabled({
          pluginId: "dev.tooldeck.json-tools",
          enabled: true,
        }),
      ).resolves.toMatchObject({
        id: "dev.tooldeck.json-tools",
        enabled: true,
      });
      await expect(
        service.runCommand({
          commandId: "json.format",
          input: {
            text: '{"a":1}',
            indent: 2,
          },
        }),
      ).resolves.toMatchObject({
        status: "success",
      });
    } finally {
      await service.dispose();
    }
  });
});

function createDatabasePath(): string {
  return path.join(createTempDir(), "tooldeck.sqlite");
}

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "tooldeck-desktop-"));

  tempDirs.push(dir);

  return dir;
}
