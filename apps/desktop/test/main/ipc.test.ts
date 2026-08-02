import type { TooldeckApplication } from "@tooldeck/application-node";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { registerTooldeckIpc } from "@/main/ipc";

describe("registerTooldeckIpc", () => {
  beforeEach(() => {
    electron.handle.mockReset();
    electron.removeHandler.mockReset();
  });

  it("forwards domain operations and returns JSON-safe success envelopes", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const installPackage = vi.fn().mockResolvedValue({
      status: "installed-refresh-failed",
      installedPluginId: "dev.example.plugin",
      packageName: "plugin.tdplugin",
      refreshError: "refresh failed",
    });

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));

    registerTooldeckIpc({
      plugins: {
        installPackage,
      },
    } as unknown as TooldeckApplication);

    await expect(
      handlers.get("tooldeck:install-plugin-package")?.(
        {},
        {
          packagePath: "C:\\plugins\\plugin.tdplugin",
          locale: "zh-CN",
        },
      ),
    ).resolves.toEqual({
      ok: true,
      value: {
        status: "installed-refresh-failed",
        installedPluginId: "dev.example.plugin",
        packageName: "plugin.tdplugin",
        refreshError: "refresh failed",
      },
    });
    expect(installPackage).toHaveBeenCalledWith("C:\\plugins\\plugin.tdplugin", {
      locale: "zh-CN",
    });
  });

  it("serializes application failures instead of throwing raw errors across IPC", async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();

    electron.handle.mockImplementation((channel, handler) => handlers.set(channel, handler));

    registerTooldeckIpc({
      commands: {
        run: vi.fn().mockRejectedValue(new Error("command failed")),
      },
    } as unknown as TooldeckApplication);

    await expect(
      handlers.get("tooldeck:run-command")?.({}, { commandId: "fixture.fail" }),
    ).resolves.toEqual({
      ok: false,
      error: {
        tag: "ApplicationError",
        source: "application",
        code: "ERR_UNKNOWN",
        message: "command failed",
      },
    });
  });

  it("removes handlers registered before a later registration fails", () => {
    electron.handle
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error("duplicate IPC handler");
      });

    expect(() => registerTooldeckIpc({} as TooldeckApplication)).toThrow("duplicate IPC handler");
    expect(electron.removeHandler).toHaveBeenCalledTimes(1);
    expect(electron.removeHandler).toHaveBeenCalledWith("tooldeck:list-commands");
  });
});
