import path from "node:path";

import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import { createDatabasePath } from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService command execution", () => {
  it("lists commands, runs json.format, and records desktop history", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      const commands = service.listCommands();
      const plugins = service.listPlugins();
      const localizedCommands = service.listCommands({ locale: "zh-CN" });
      const localizedPlugins = service.listPlugins({ locale: "zh-CN" });

      expect(commands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            pluginId: "dev.tooldeck.json-tools",
            pluginEnabled: true,
            pluginRuntimeState: "inactive",
            title: "Format JSON",
            "x-ui": {
              layout: "split",
            },
          }),
        ]),
      );
      expect(localizedCommands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            title: "格式化 JSON",
            description: "使用可配置缩进格式化 JSON 文本。",
            inputSchema: expect.objectContaining({
              properties: expect.objectContaining({
                text: expect.objectContaining({
                  title: "JSON 文本",
                }),
                indent: expect.objectContaining({
                  title: "缩进大小",
                }),
              }),
            }),
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
      expect(localizedPlugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            name: "JSON 工具",
            description: "用于格式化 JSON 的工具。",
          }),
        ]),
      );
      await expect(service.rescanPlugins({ locale: "zh-CN" })).resolves.toMatchObject({
        commands: expect.arrayContaining([
          expect.objectContaining({
            id: "json.format",
            title: "格式化 JSON",
          }),
        ]),
        plugins: expect.arrayContaining([
          expect.objectContaining({
            id: "dev.tooldeck.json-tools",
            name: "JSON 工具",
          }),
        ]),
      });

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
      expect(service.listCommandRuns({ commandId: "json.format" })).toHaveLength(1);
      expect(service.listCommandRuns({ commandId: "json.validate" })).toHaveLength(0);
    } finally {
      await service.dispose();
    }
  });
});
