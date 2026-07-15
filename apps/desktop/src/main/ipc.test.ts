import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TooldeckDesktopService } from "./tooldeck-service";

const electron = vi.hoisted(() => ({
  handle: vi.fn(),
  removeHandler: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electron.handle,
    removeHandler: electron.removeHandler,
  },
}));

import { registerTooldeckIpc } from "./ipc";

describe("registerTooldeckIpc", () => {
  beforeEach(() => {
    electron.handle.mockReset();
    electron.removeHandler.mockReset();
  });

  it("forwards plugin package installation and removes the handler on dispose", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const installPluginPackage = vi.fn().mockResolvedValue({
      status: "installed",
      installedPluginId: "dev.example.plugin",
    });
    const request = {
      packagePath: "C:\\plugins\\plugin.tdplugin",
      locale: "zh-CN",
    };

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));

    const dispose = registerTooldeckIpc({
      installPluginPackage,
    } as unknown as TooldeckDesktopService);
    const handler = handlers.get("tooldeck:install-plugin-package");

    await expect(handler?.({}, request)).resolves.toMatchObject({ status: "installed" });
    expect(installPluginPackage).toHaveBeenCalledWith(request);

    dispose();

    expect(electron.removeHandler).toHaveBeenCalledWith("tooldeck:install-plugin-package");
  });
});
