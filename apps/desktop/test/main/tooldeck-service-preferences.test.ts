import path from "node:path";

import { describe, expect, it } from "vitest";

import { TooldeckDesktopService } from "@/main/tooldeck-service";

import { createDatabasePath } from "./tooldeck-service-fixtures";

describe("TooldeckDesktopService preferences", () => {
  it("stores desktop-visible preferences", async () => {
    const service = new TooldeckDesktopService({
      pluginsRoot: path.resolve("../..", "plugins"),
      storagePath: createDatabasePath(),
    });

    await service.start();

    try {
      expect(service.listPreferences()).toEqual([
        expect.objectContaining({
          scope: "shared",
          key: "locale",
          value: "system",
        }),
        expect.objectContaining({
          scope: "desktop",
          key: "navigation.mode",
          value: "provider-first",
        }),
        expect.objectContaining({
          scope: "desktop",
          key: "sidebar.collapsed",
          value: false,
        }),
      ]);
      expect(
        service.getPreference({
          scope: "shared",
          key: "locale",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "system",
      });

      expect(
        service.setPreference({
          scope: "shared",
          key: "locale",
          value: "zh-CN",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
        updatedAt: expect.any(Number),
      });
      expect(service.listPreferences()).toEqual([
        expect.objectContaining({
          scope: "shared",
          key: "locale",
          value: "zh-CN",
        }),
        expect.objectContaining({
          scope: "desktop",
          key: "navigation.mode",
          value: "provider-first",
        }),
        expect.objectContaining({
          scope: "desktop",
          key: "sidebar.collapsed",
          value: false,
        }),
      ]);
      expect(
        service.getPreference({
          scope: "shared",
          key: "locale",
        }),
      ).toMatchObject({
        scope: "shared",
        key: "locale",
        value: "zh-CN",
      });
      expect(
        service.setPreference({
          scope: "desktop",
          key: "navigation.mode",
          value: "entry-first",
        }),
      ).toMatchObject({
        scope: "desktop",
        key: "navigation.mode",
        value: "entry-first",
      });
      expect(
        service.setPreference({
          scope: "desktop",
          key: "sidebar.collapsed",
          value: true,
        }),
      ).toMatchObject({
        scope: "desktop",
        key: "sidebar.collapsed",
        value: true,
      });
      expect(() =>
        service.setPreference({
          scope: "cli",
          key: "output.format",
          value: "json",
        }),
      ).toThrow("Desktop cannot manage preference: cli.output.format");
      expect(() =>
        service.getPreference({
          scope: "cli",
          key: "output.format",
        }),
      ).toThrow("Desktop cannot manage preference: cli.output.format");
    } finally {
      await service.dispose();
    }
  });
});
