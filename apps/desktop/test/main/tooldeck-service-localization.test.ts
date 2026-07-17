import path from "node:path";

import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import { createDatabasePath } from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService localization", () => {
  it("localizes command result properties", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      await expect(
        service.runCommand({
          commandId: "regex.test",
          locale: "zh-CN",
          input: {
            pattern: "[0-9]+",
            text: "abc123",
            flags: [],
            mode: "contains",
          },
        }),
      ).resolves.toMatchObject({
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
    } finally {
      await service.dispose();
    }
  });
});
