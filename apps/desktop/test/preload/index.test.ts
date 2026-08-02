import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DesktopApi } from "@/shared/api";

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

describe("desktop preload API", () => {
  beforeEach(() => {
    electron.getPathForFile.mockReset();
    electron.invoke.mockReset();
  });

  it("exposes a single API grouped by domain", () => {
    expect(api).toEqual({
      commands: expect.objectContaining({
        list: expect.any(Function),
        run: expect.any(Function),
      }),
      plugins: expect.objectContaining({
        list: expect.any(Function),
        installDroppedPackage: expect.any(Function),
      }),
      preferences: expect.objectContaining({
        list: expect.any(Function),
        get: expect.any(Function),
        set: expect.any(Function),
      }),
      history: expect.objectContaining({
        listRuns: expect.any(Function),
      }),
    });
  });

  it("resolves dropped file paths inside preload and invokes installation", async () => {
    const file = { name: "plugin.tdplugin" } as File;
    const expected = { status: "installed", installedPluginId: "dev.example.plugin" };

    electron.getPathForFile.mockReturnValue("C:\\plugins\\plugin.tdplugin");
    electron.invoke.mockResolvedValue({ ok: true, value: expected });

    await expect(api.plugins.installDroppedPackage(file, { locale: "zh-CN" })).resolves.toBe(
      expected,
    );
    expect(electron.getPathForFile).toHaveBeenCalledWith(file);
    expect(electron.invoke).toHaveBeenCalledWith("tooldeck:install-plugin-package", {
      packagePath: "C:\\plugins\\plugin.tdplugin",
      locale: "zh-CN",
    });
  });

  it("rejects files that are not backed by a local path", () => {
    electron.getPathForFile.mockReturnValue("");

    expect(() => api.plugins.installDroppedPackage({ name: "plugin.tdplugin" } as File)).toThrow(
      "Dropped plugin package is not backed by a local file.",
    );
    expect(electron.invoke).not.toHaveBeenCalled();
  });

  it("rejects serialized application failures without exposing raw main errors", async () => {
    const error = {
      tag: "ApplicationError" as const,
      source: "application" as const,
      code: "ERR_NOT_FOUND",
      message: "Plugin was not found.",
    };

    electron.invoke.mockResolvedValue({ ok: false, error });

    await expect(api.plugins.uninstall({ pluginId: "dev.example.missing" })).rejects.toBe(error);
  });
});
