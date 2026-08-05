import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialState } from "@/renderer/app/types";
import type { DesktopApi, DesktopCommand, DesktopPlugin } from "@/shared/api";

let useDesktopStore: (typeof import("@/renderer/app/store"))["useDesktopStore"];
let tooldeck: {
  plugins: Pick<
    DesktopApi["plugins"],
    "installDroppedPackage" | "listDataResidues" | "purgeData" | "rescan" | "uninstall"
  >;
  history: Pick<DesktopApi["history"], "listRuns">;
};

describe("catalog slice plugin installation", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", createMemoryStorage());

    tooldeck = {
      plugins: {
        installDroppedPackage: vi.fn(),
        listDataResidues: vi.fn().mockResolvedValue([]),
        purgeData: vi.fn(),
        rescan: vi.fn(),
        uninstall: vi.fn(),
      },
      history: {
        listRuns: vi.fn().mockResolvedValue([]),
      },
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

    vi.mocked(tooldeck.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed",
      installedPluginId: plugin.id,
      packageName: file.name,
      commands: [command],
      plugins: [plugin],
    });

    await useDesktopStore.getState().installDroppedPluginPackage(file);

    expect(tooldeck.plugins.installDroppedPackage).toHaveBeenCalledWith(file, {
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
    vi.mocked(tooldeck.plugins.installDroppedPackage).mockResolvedValue({
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
    vi.mocked(tooldeck.plugins.rescan).mockResolvedValue({
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
    vi.mocked(tooldeck.plugins.installDroppedPackage).mockRejectedValue(
      new Error("invalid package"),
    );

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

  it("uninstalls a plugin and exposes its retained local data", async () => {
    const plugin = createPlugin("dev.example.installed");

    useDesktopStore.setState({ plugins: [plugin], selectedPluginId: plugin.id });
    vi.mocked(tooldeck.plugins.uninstall).mockResolvedValue({
      cleanupFailures: [],
      cleanupPending: false,
      commands: [],
      filesMissing: false,
      pluginId: plugin.id,
      plugins: [],
      residues: [{ pluginId: plugin.id, statePresent: true, kvEntries: 2 }],
    });

    await useDesktopStore.getState().uninstallPlugin(plugin.id);

    expect(tooldeck.plugins.uninstall).toHaveBeenCalledWith({
      pluginId: plugin.id,
      locale: expect.any(String),
    });
    expect(useDesktopStore.getState()).toMatchObject({
      plugins: [],
      pluginDataResidues: [{ pluginId: plugin.id, statePresent: true, kvEntries: 2 }],
      selectedPluginId: undefined,
    });
  });

  it("surfaces a warning after logically successful uninstall retains cleanup", async () => {
    const plugin = createPlugin("dev.example.retained-cleanup");

    useDesktopStore.setState({ plugins: [plugin], selectedPluginId: plugin.id });
    vi.mocked(tooldeck.plugins.uninstall).mockResolvedValue({
      cleanupPending: true,
      cleanupFailures: [
        {
          phase: "cleanup",
          step: "pluginQuarantine.remove",
          context: { pluginId: plugin.id, stagingEntry: "uninstall-example" },
          error: {
            source: "application",
            code: "ERR_UNKNOWN",
            message: "file is locked",
          },
        },
      ],
      commands: [],
      filesMissing: false,
      pluginId: plugin.id,
      plugins: [],
      residues: [],
    });

    await useDesktopStore.getState().uninstallPlugin(plugin.id);

    expect(useDesktopStore.getState()).toMatchObject({
      loadError: undefined,
      pluginCleanupWarning: {
        count: 1,
        step: "pluginQuarantine.remove",
        message: "file is locked",
      },
    });
  });

  it("purges retained plugin data", async () => {
    const pluginId = "dev.example.uninstalled";

    useDesktopStore.setState({
      pluginDataResidues: [{ pluginId, statePresent: true, kvEntries: 2 }],
    });
    vi.mocked(tooldeck.plugins.purgeData).mockResolvedValue({
      pluginId,
      stateRemoved: true,
      kvEntriesRemoved: 2,
      residues: [],
    });

    await useDesktopStore.getState().purgePluginData(pluginId);

    expect(tooldeck.plugins.purgeData).toHaveBeenCalledWith({ pluginId });
    expect(useDesktopStore.getState().pluginDataResidues).toEqual([]);
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
