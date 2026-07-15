import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DesktopApi } from "@/shared/desktop-api";

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  getPathForFile: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electron.exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: electron.invoke,
  },
  webUtils: {
    getPathForFile: electron.getPathForFile,
  },
}));

await import("@/preload/index");

const api = electron.exposeInMainWorld.mock.calls[0]?.[1] as DesktopApi;

describe("desktop preload plugin installation", () => {
  beforeEach(() => {
    electron.getPathForFile.mockReset();
    electron.invoke.mockReset();
  });

  it("resolves the original dropped File path inside preload and invokes installation", async () => {
    const file = { name: "plugin.tdplugin" } as File;
    const expected = { status: "installed", installedPluginId: "dev.example.plugin" };

    electron.getPathForFile.mockReturnValue("C:\\plugins\\plugin.tdplugin");
    electron.invoke.mockResolvedValue(expected);

    await expect(api.installDroppedPluginPackage(file, { locale: "zh-CN" })).resolves.toBe(
      expected,
    );
    expect(electron.getPathForFile).toHaveBeenCalledWith(file);
    expect(electron.invoke).toHaveBeenCalledWith("tooldeck:install-plugin-package", {
      packagePath: "C:\\plugins\\plugin.tdplugin",
      locale: "zh-CN",
    });
  });

  it("rejects Files that are not backed by a local path", () => {
    electron.getPathForFile.mockReturnValue("");

    expect(() => api.installDroppedPluginPackage({ name: "plugin.tdplugin" } as File)).toThrow(
      "Dropped plugin package is not backed by a local file.",
    );
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it("invokes plugin residue, uninstall, and purge channels", async () => {
    electron.invoke.mockResolvedValue([]);

    await api.listPluginDataResidues();
    await api.uninstallPlugin({ pluginId: "dev.example.plugin", locale: "zh-CN" });
    await api.purgePluginData({ pluginId: "dev.example.plugin" });

    expect(electron.invoke).toHaveBeenNthCalledWith(1, "tooldeck:list-plugin-data-residues");
    expect(electron.invoke).toHaveBeenNthCalledWith(2, "tooldeck:uninstall-plugin", {
      pluginId: "dev.example.plugin",
      locale: "zh-CN",
    });
    expect(electron.invoke).toHaveBeenNthCalledWith(3, "tooldeck:purge-plugin-data", {
      pluginId: "dev.example.plugin",
    });
  });
});
