import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialState } from "@/renderer/app/types";
import type { DesktopApi, DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

let useDesktopStore: (typeof import("@/renderer/app/store"))["useDesktopStore"];
let tooldeck: Pick<DesktopApi, "installDroppedPluginPackage" | "listCommandRuns" | "rescanPlugins">;

describe("catalog slice plugin installation", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", createMemoryStorage());

    tooldeck = {
      installDroppedPluginPackage: vi.fn(),
      listCommandRuns: vi.fn().mockResolvedValue([]),
      rescanPlugins: vi.fn(),
    };
    vi.stubGlobal("window", { tooldeck });

    ({ useDesktopStore } = await import("@/renderer/app/store"));
    useDesktopStore.setState({
      ...initialState,
      view: "main",
    });
  });

  it("updates the catalog and selects the installed plugin", async () => {
    const file = { name: "installed.tdplugin" } as File;
    const plugin = createPlugin("dev.example.installed");
    const command = createCommand(plugin.id);

    vi.mocked(tooldeck.installDroppedPluginPackage).mockResolvedValue({
      status: "installed",
      installedPluginId: plugin.id,
      packageName: file.name,
      commands: [command],
      plugins: [plugin],
    });

    await useDesktopStore.getState().installDroppedPluginPackage(file);

    expect(tooldeck.installDroppedPluginPackage).toHaveBeenCalledWith(file, {
      locale: expect.any(String),
    });
    expect(useDesktopStore.getState()).toMatchObject({
      commands: [command],
      plugins: [plugin],
      selectedCommandId: undefined,
      selectedPluginId: plugin.id,
      pluginInstall: {
        status: "success",
        pluginId: plugin.id,
        packageName: file.name,
      },
    });
  });

  it("keeps the existing catalog when runtime refresh fails after commit", async () => {
    const existingPlugin = createPlugin("dev.example.existing", "builtin");
    const file = { name: "installed.tdplugin" } as File;

    useDesktopStore.setState({ plugins: [existingPlugin] });
    vi.mocked(tooldeck.installDroppedPluginPackage).mockResolvedValue({
      status: "installed-refresh-failed",
      installedPluginId: "dev.example.installed",
      packageName: file.name,
      refreshError: "forced refresh failure",
    });

    await useDesktopStore.getState().installDroppedPluginPackage(file);

    expect(useDesktopStore.getState()).toMatchObject({
      plugins: [existingPlugin],
      pluginInstall: {
        status: "refresh-failed",
        pluginId: "dev.example.installed",
        packageName: file.name,
        message: "forced refresh failure",
      },
    });
  });

  it("recovers a committed install warning after a successful rescan", async () => {
    const plugin = createPlugin("dev.example.installed");
    const command = createCommand(plugin.id);

    useDesktopStore.setState({
      pluginInstall: {
        status: "refresh-failed",
        pluginId: plugin.id,
        packageName: "installed.tdplugin",
        message: "forced refresh failure",
      },
    });
    vi.mocked(tooldeck.rescanPlugins).mockResolvedValue({
      commands: [command],
      plugins: [plugin],
    });

    await useDesktopStore.getState().rescanPlugins();

    expect(useDesktopStore.getState().pluginInstall).toEqual({
      status: "success",
      pluginId: plugin.id,
      packageName: "installed.tdplugin",
    });
    expect(useDesktopStore.getState()).toMatchObject({
      selectedCommandId: undefined,
      selectedPluginId: plugin.id,
    });
  });

  it("stores installation errors separately from workspace load errors", async () => {
    vi.mocked(tooldeck.installDroppedPluginPackage).mockRejectedValue(new Error("invalid package"));

    await useDesktopStore
      .getState()
      .installDroppedPluginPackage({ name: "invalid.tdplugin" } as File);

    expect(useDesktopStore.getState().loadError).toBeUndefined();
    expect(useDesktopStore.getState()).toMatchObject({
      pluginInstall: {
        status: "error",
        message: "invalid package",
      },
    });
  });
});

function createPlugin(
  id: string,
  sourceKind: DesktopPlugin["sourceKind"] = "installed",
): DesktopPlugin {
  return {
    id,
    name: id,
    version: "1.0.0",
    manifestPath: `C:\\plugins\\${id}\\manifest.json`,
    sourceKind,
    enabled: true,
    runtimeState: "inactive",
    commandCount: 1,
    updatedAt: 1000,
    searchText: [],
  };
}

function createCommand(pluginId: string): DesktopCommand {
  return {
    id: "installed.echo",
    pluginId,
    pluginEnabled: true,
    pluginRuntimeState: "inactive",
    title: "Installed Echo",
    searchText: [],
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}
