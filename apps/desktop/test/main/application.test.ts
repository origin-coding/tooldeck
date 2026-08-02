import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDesktopApplication } from "@/main/application";
import { toDesktopCommand } from "@/main/desktop-contract/catalog";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("createDesktopApplication", () => {
  it("uses application-node and preserves localized command results", async () => {
    const userDataDir = createTemporaryDirectory();
    const workspaceRoot = path.resolve("../..");
    const application = createDesktopApplication({
      mode: "development",
      workspaceRoot,
      builtinPluginsDir: path.join(workspaceRoot, "plugins"),
      userDataDir,
    });

    await application.start();

    try {
      const [commands, plugins] = await Promise.all([
        application.commands.list({ locale: "zh-CN" }),
        application.plugins.list({ locale: "zh-CN" }),
      ]);
      const command = commands.find((candidate) => candidate.id === "regex.test")!;
      const plugin = plugins.find((candidate) => candidate.id === command.pluginId)!;
      const desktopCommand = toDesktopCommand(command, plugin);

      expect(desktopCommand).toMatchObject({
        title: "测试正则",
        inputSchema: {
          properties: {
            pattern: {
              title: "模式",
            },
          },
        },
      });
      expect(desktopCommand.searchText).toEqual(
        expect.arrayContaining(["Test Regex", "测试正则", "Regex Tools", "正则表达式工具"]),
      );
      expect(desktopCommand.searchText).not.toContain("替换正则匹配");

      const result = await application.commands.run({
        commandId: "regex.test",
        locale: "zh-CN",
        source: "desktop",
        input: {
          pattern: "[0-9]+",
          text: "abc123",
          flags: [],
          mode: "contains",
        },
      });

      expect(result).toMatchObject({
        status: "success",
        blocks: [
          {
            type: "properties",
            items: expect.arrayContaining([
              expect.objectContaining({
                label: "是否匹配",
                value: true,
              }),
            ]),
          },
          {
            type: "json",
          },
        ],
      });
      await expect(application.history.listCommandRuns()).resolves.toMatchObject([
        {
          output: {
            blocks: [
              {
                type: "properties",
                items: expect.arrayContaining([
                  expect.objectContaining({
                    label: "是否匹配",
                  }),
                ]),
              },
              {
                type: "json",
              },
            ],
          },
        },
      ]);
    } finally {
      await application.dispose();
    }
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "tooldeck-desktop-"));
  temporaryDirectories.push(directory);
  return directory;
}
