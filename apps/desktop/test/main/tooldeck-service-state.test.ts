import path from "node:path";

import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import { createDatabasePath } from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService plugin state", () => {
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
