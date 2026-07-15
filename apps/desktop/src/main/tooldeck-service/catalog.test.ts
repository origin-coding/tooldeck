import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { TooldeckDesktopCatalogService } from "./catalog";
import type { TooldeckDesktopServiceContext } from "./context";
import type { TooldeckDesktopRuntimeService } from "./runtime";

describe("TooldeckDesktopCatalogService plugin installation", () => {
  it("reports a committed install when the Desktop runtime refresh fails", async () => {
    const packagePath = path.resolve("dev.example.plugin.tdplugin");
    const installPackage = vi.fn().mockResolvedValue({
      install: {
        packageName: "dev.example.plugin.tdplugin",
      },
      plugin: {
        id: "dev.example.plugin",
      },
    });
    const context = {
      requirePluginManagement: () => ({ installPackage }),
    } as unknown as TooldeckDesktopServiceContext;
    const runtime = {
      scanAndCreateRuntime: vi.fn().mockRejectedValue(new Error("forced refresh failure")),
    } as unknown as TooldeckDesktopRuntimeService;
    const catalog = new TooldeckDesktopCatalogService(context, runtime);

    await expect(catalog.installPluginPackage({ packagePath })).resolves.toEqual({
      status: "installed-refresh-failed",
      installedPluginId: "dev.example.plugin",
      packageName: "dev.example.plugin.tdplugin",
      refreshError: "forced refresh failure",
    });
    expect(installPackage).toHaveBeenCalledWith(packagePath);
  });

  it("rejects non-absolute package paths before installation", async () => {
    const installPackage = vi.fn();
    const context = {
      requirePluginManagement: () => ({ installPackage }),
    } as unknown as TooldeckDesktopServiceContext;
    const catalog = new TooldeckDesktopCatalogService(context, {} as TooldeckDesktopRuntimeService);

    await expect(
      catalog.installPluginPackage({ packagePath: "relative-plugin.tdplugin" }),
    ).rejects.toThrow("Desktop plugin installation requires an absolute package path.");
    expect(installPackage).not.toHaveBeenCalled();
  });
});
