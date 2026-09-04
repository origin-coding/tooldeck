import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DesktopApi, DesktopApiError, DesktopCommand, DesktopPlugin } from "@/shared/api";

afterEach(() => vi.unstubAllGlobals());

describe("workspace actions and feature state", () => {
  let actions: ReturnType<(typeof import("@/renderer/app/workspace"))["useWorkspaceActions"]>;
  let catalog: ReturnType<(typeof import("@/renderer/features/catalog/store"))["useCatalogStore"]>;
  let commands: ReturnType<
    (typeof import("@/renderer/features/commands/store"))["useCommandsStore"]
  >;
  let plugins: ReturnType<(typeof import("@/renderer/features/plugins/store"))["usePluginsStore"]>;
  let preferences: ReturnType<
    (typeof import("@/renderer/features/preferences/store"))["usePreferencesStore"]
  >;
  let history: ReturnType<(typeof import("@/renderer/features/history/store"))["useHistoryStore"]>;
  let api: DesktopApi;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", createMemoryStorage());
    api = {
      commands: { list: vi.fn().mockResolvedValue([]), run: vi.fn() },
      plugins: {
        list: vi.fn().mockResolvedValue([]),
        listDataResidues: vi.fn().mockResolvedValue([]),
        installDroppedPackage: vi.fn(),
        rescan: vi.fn(),
        setEnabled: vi.fn(),
        uninstall: vi.fn(),
        purgeData: vi.fn(),
      },
      preferences: { list: vi.fn().mockResolvedValue([]), get: vi.fn(), set: vi.fn() },
      history: { listRuns: vi.fn().mockResolvedValue([]) },
    };
    vi.stubGlobal("window", { tooldeck: api });
    const { createPinia, setActivePinia } = await import("pinia");
    setActivePinia(createPinia());
    const { useWorkspaceActions } = await import("@/renderer/app/workspace");
    const { useCatalogStore } = await import("@/renderer/features/catalog/store");
    const { useCommandsStore } = await import("@/renderer/features/commands/store");
    const { usePluginsStore } = await import("@/renderer/features/plugins/store");
    const { usePreferencesStore } = await import("@/renderer/features/preferences/store");
    const { useHistoryStore } = await import("@/renderer/features/history/store");
    actions = useWorkspaceActions();
    catalog = useCatalogStore();
    commands = useCommandsStore();
    plugins = usePluginsStore();
    preferences = usePreferencesStore();
    history = useHistoryStore();
    await actions.initialize();
  });

  it("updates the catalog and returns the installed plugin for navigation", async () => {
    const file = { name: "installed.tdplugin" } as File;
    const plugin = createPlugin("dev.example.installed");
    const command = createCommand(plugin.id);

    vi.mocked(api.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed",
      installedPluginId: plugin.id,
      packageName: file.name,
      commands: [command],
      plugins: [plugin],
    });

    expect(await actions.install(file)).toBe(plugin.id);

    expect(api.plugins.installDroppedPackage).toHaveBeenCalledWith(file, {
      locale: expect.any(String),
    });
    expect(catalog).toMatchObject({
      commands: [command],
      plugins: [plugin],
    });
    expect(plugins).toMatchObject({
      installState: {
        status: "success",
        pluginId: plugin.id,
        packageName: file.name,
      },
    });
  });

  it("keeps the existing catalog when runtime refresh fails after commit", async () => {
    const existingPlugin = createPlugin("dev.example.existing", "builtin");
    const file = { name: "installed.tdplugin" } as File;

    catalog.plugins = [existingPlugin];
    vi.mocked(api.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed-refresh-failed",
      installedPluginId: "dev.example.installed",
      packageName: file.name,
      refreshError: "forced refresh failure",
    });

    await actions.install(file);

    expect(catalog.plugins).toEqual([existingPlugin]);
    expect(plugins).toMatchObject({
      installState: {
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

    plugins.installState = {
      status: "refresh-failed",
      pluginId: plugin.id,
      packageName: "installed.tdplugin",
      message: "forced refresh failure",
    };
    vi.mocked(api.plugins.rescan).mockResolvedValue({
      commands: [command],
      plugins: [plugin],
    });

    await actions.rescan();

    expect(plugins.installState).toEqual({
      status: "success",
      pluginId: plugin.id,
      packageName: "installed.tdplugin",
    });
    expect(catalog.commands).toEqual([command]);
    expect(catalog.plugins).toEqual([plugin]);
  });

  it.each([
    { name: "local error", error: new Error("invalid package") },
    {
      name: "Desktop API error",
      error: {
        tag: "ApplicationError",
        source: "application",
        code: "ERR_INVALID_ARGUMENT",
        message: "invalid package",
      } satisfies DesktopApiError,
    },
  ])("stores $name separately from workspace load errors", async ({ error }) => {
    vi.mocked(api.plugins.installDroppedPackage).mockRejectedValue(error);

    await actions.install({ name: "invalid.tdplugin" } as File);

    expect(actions.error).toBeUndefined();
    expect(plugins.error).toBeUndefined();
    expect(preferences.error).toBeUndefined();
    expect(plugins).toMatchObject({
      installState: {
        status: "error",
        message: "invalid package",
      },
    });
  });

  it("uninstalls a plugin and exposes its retained local data", async () => {
    const plugin = createPlugin("dev.example.installed");

    catalog.plugins = [plugin];
    vi.mocked(api.plugins.uninstall).mockResolvedValue({
      cleanupFailures: [],
      cleanupPending: false,
      commands: [],
      filesMissing: false,
      pluginId: plugin.id,
      plugins: [],
      residues: [{ pluginId: plugin.id, statePresent: true, kvEntries: 2 }],
    });

    await actions.uninstall(plugin.id);

    expect(api.plugins.uninstall).toHaveBeenCalledWith({
      pluginId: plugin.id,
      locale: expect.any(String),
    });
    expect(catalog.plugins).toEqual([]);
    expect(plugins.residues).toEqual([{ pluginId: plugin.id, statePresent: true, kvEntries: 2 }]);
  });

  it("surfaces a warning after logically successful uninstall retains cleanup", async () => {
    const plugin = createPlugin("dev.example.retained-cleanup");

    catalog.plugins = [plugin];
    vi.mocked(api.plugins.uninstall).mockResolvedValue({
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

    await actions.uninstall(plugin.id);

    expect(actions.error).toBeUndefined();
    expect(preferences.error).toBeUndefined();
    expect(plugins).toMatchObject({
      error: undefined,
      cleanupWarning: {
        count: 1,
        step: "pluginQuarantine.remove",
        message: "file is locked",
      },
    });
  });

  it("purges retained plugin data", async () => {
    const pluginId = "dev.example.uninstalled";

    plugins.residues = [{ pluginId, statePresent: true, kvEntries: 2 }];
    vi.mocked(api.plugins.purgeData).mockResolvedValue({
      pluginId,
      stateRemoved: true,
      kvEntriesRemoved: 2,
      residues: [],
    });

    await actions.purge(pluginId);

    expect(api.plugins.purgeData).toHaveBeenCalledWith({ pluginId });
    expect(plugins.residues).toEqual([]);
  });

  it("keeps a committed install successful when the residue query fails", async () => {
    const plugin = createPlugin("dev.example.installed");
    vi.mocked(api.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed",
      installedPluginId: plugin.id,
      packageName: "example.tdplugin",
      commands: [],
      plugins: [plugin],
    });
    vi.mocked(api.plugins.listDataResidues).mockRejectedValue(new Error("residue query failed"));

    expect(await actions.install({ name: "example.tdplugin" } as File)).toBe(plugin.id);
    expect(plugins.installState.status).toBe("success");
    expect(catalog.plugins).toEqual([plugin]);
    expect(plugins.error).toBe("residue query failed");

    vi.mocked(api.plugins.listDataResidues).mockResolvedValue([]);
    vi.mocked(api.plugins.rescan).mockResolvedValue({ commands: [], plugins: [plugin] });
    await actions.rescan();
    expect(actions.error).toBeUndefined();
    expect(plugins.error).toBeUndefined();
    expect(preferences.error).toBeUndefined();
    expect(plugins.installState.status).toBe("success");
  });

  it("blocks command and plugin mutations until a committed install is rescanned", async () => {
    const plugin = createPlugin("dev.example.installed");
    const command = createCommand(plugin.id);
    catalog.commands = [command];
    vi.mocked(api.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed-refresh-failed",
      installedPluginId: plugin.id,
      packageName: "example.tdplugin",
      refreshError: "refresh failed",
    });
    await actions.install({ name: "example.tdplugin" } as File);
    await actions.run(command.id);
    await actions.setEnabled(plugin.id, false);
    expect(api.commands.run).not.toHaveBeenCalled();
    expect(api.plugins.setEnabled).not.toHaveBeenCalled();

    vi.mocked(api.plugins.rescan).mockResolvedValue({ commands: [command], plugins: [plugin] });
    await actions.rescan();
    expect(plugins.installState.status).toBe("success");
    expect(actions.blocked).toBe(false);
  });

  it("preserves the latest history filter when an older request finishes last", async () => {
    let resolveOlder!: (value: Awaited<ReturnType<DesktopApi["history"]["listRuns"]>>) => void;
    vi.mocked(api.history.listRuns).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOlder = resolve;
        }),
    );
    const older = history.load("first.command");
    const run = {
      id: "second-run",
      commandId: "second.command",
      source: "desktop",
      status: "success" as const,
      createdAt: 1000,
    };
    vi.mocked(api.history.listRuns).mockResolvedValueOnce([run]);
    await history.load("second.command");
    resolveOlder([]);
    await older;
    expect(history.history).toEqual([run]);
  });

  it("waits for startup reads to settle before allowing a failed initialization to retry", async () => {
    const pendingPreferences = deferred<Awaited<ReturnType<DesktopApi["preferences"]["list"]>>>();
    actions.initialized = false;
    vi.mocked(api.preferences.list).mockReturnValueOnce(pendingPreferences.promise);
    vi.mocked(api.plugins.listDataResidues).mockRejectedValueOnce(new Error("startup read failed"));
    const initializing = actions.initialize();
    try {
      await Promise.resolve();
      expect(actions.loading).toBe(true);
      expect(actions.initialized).toBe(false);
      await actions.initialize();
      expect(actions.loading).toBe(true);
    } finally {
      pendingPreferences.resolve([]);
      await initializing;
    }
    expect(actions.loading).toBe(false);
    expect(actions.error).toBe("startup read failed");
    await actions.initialize();
    expect(actions.initialized).toBe(true);
    expect(actions.error).toBeUndefined();
    expect(plugins.error).toBeUndefined();
    expect(preferences.error).toBeUndefined();
  });

  it("keeps operations blocked after install commit until residues finish refreshing", async () => {
    const residueQuery = deferred<Awaited<ReturnType<DesktopApi["plugins"]["listDataResidues"]>>>();
    const plugin = createPlugin("dev.example.committed");
    const command = createCommand(plugin.id);
    vi.mocked(api.plugins.installDroppedPackage).mockResolvedValue({
      status: "installed",
      installedPluginId: plugin.id,
      packageName: "example.tdplugin",
      commands: [command],
      plugins: [plugin],
    });
    vi.mocked(api.plugins.listDataResidues).mockReturnValueOnce(residueQuery.promise);

    const installing = actions.install({ name: "example.tdplugin" } as File);
    try {
      await vi.waitFor(() => expect(plugins.installState.status).toBe("success"));
      expect(actions.blocked).toBe(true);
      await actions.run(command.id);
      await actions.setEnabled(plugin.id, false);
      expect(api.commands.run).not.toHaveBeenCalled();
      expect(api.plugins.setEnabled).not.toHaveBeenCalled();
    } finally {
      residueQuery.resolve([]);
      await installing;
    }
    expect(actions.blocked).toBe(false);
  });

  it("retains a successful result and holds admission until every post-run refresh settles", async () => {
    const pendingHistory = deferred<Awaited<ReturnType<DesktopApi["history"]["listRuns"]>>>();
    const command = createCommand("dev.example.json");
    catalog.commands = [command];
    const result = { status: "success" as const, blocks: [] };
    vi.mocked(api.commands.run).mockResolvedValue(result);
    vi.mocked(api.commands.list).mockRejectedValue(new Error("catalog refresh failed"));
    vi.mocked(api.history.listRuns).mockReturnValueOnce(pendingHistory.promise);
    const running = actions.run(command.id);
    try {
      await vi.waitFor(() => expect(commands.results[command.id]).toEqual(result));
      expect(actions.blocked).toBe(true);
      await actions.setEnabled(command.pluginId, false);
      expect(api.plugins.setEnabled).not.toHaveBeenCalled();
    } finally {
      pendingHistory.resolve([]);
      await running;
    }
    expect(actions.blocked).toBe(false);
    expect(commands.results[command.id]).toEqual(result);
    expect(commands.runErrors[command.id]).toBeUndefined();
    expect(actions.error).toBe("catalog refresh failed");
  });

  it("does not let an older catalog response overwrite a committed plugin snapshot", async () => {
    const pendingCommands = deferred<DesktopCommand[]>();
    vi.mocked(api.commands.list).mockReturnValueOnce(pendingCommands.promise);
    const refresh = catalog.refresh("en-US");
    const plugin = createPlugin("dev.example.new");
    const command = createCommand(plugin.id);
    vi.mocked(api.plugins.rescan).mockResolvedValue({ plugins: [plugin], commands: [command] });
    await actions.rescan();
    pendingCommands.resolve([]);
    await refresh;
    expect(catalog.plugins).toEqual([plugin]);
    expect(catalog.commands).toEqual([command]);
  });

  it("refreshes localized catalog data without discarding the command draft", async () => {
    const command = {
      ...createCommand("dev.example.localized"),
      inputSchema: { type: "object" as const, properties: { text: { type: "string" as const } } },
    };
    catalog.commands = [command];
    commands.setInput(command.id, "text", "unfinished input");
    vi.mocked(api.preferences.set).mockResolvedValue({
      scope: "shared",
      key: "locale",
      value: "zh-CN",
      defaultValue: "system",
      description: "Language",
      valueType: "enum",
    });
    vi.mocked(api.commands.list).mockResolvedValue([{ ...command, title: "本地化命令" }]);
    expect(await actions.setPreference("shared", "locale", "zh-CN")).toBe(true);
    expect(preferences.locale).toBe("zh-CN");
    expect(api.commands.list).toHaveBeenLastCalledWith({ locale: "zh-CN" });
    expect(api.plugins.list).toHaveBeenLastCalledWith({ locale: "zh-CN" });
    expect(catalog.commands[0]?.title).toBe("本地化命令");
    expect(commands.drafts[command.id]).toEqual({ text: "unfinished input" });
  });

  it("keeps preference write failures in preferences instead of startup state", async () => {
    vi.mocked(api.preferences.set).mockRejectedValue(new Error("preference write failed"));
    expect(await actions.setPreference("desktop", "sidebar.collapsed", true)).toBe(false);
    expect(preferences.error).toBe("preference write failed");
    expect(actions.error).toBeUndefined();
    expect(preferences.collapsed).toBe(false);
    expect(actions.blocked).toBe(false);
  });

  it("updates derived command output when recursive JSON results are replaced", async () => {
    const { computed } = await import("vue");
    const command = createCommand("dev.example.json");
    catalog.commands = [command];
    vi.mocked(api.commands.list).mockResolvedValue([command]);
    const output = computed(() => commands.results[command.id]);
    expect(output.value).toBeUndefined();

    const result: Awaited<ReturnType<DesktopApi["commands"]["run"]>> = {
      status: "success",
      blocks: [{ type: "json", value: { nested: [{ values: [1, null, true] }] } }],
    };
    vi.mocked(api.commands.run).mockResolvedValueOnce(result);
    await actions.run(command.id);
    expect(output.value).toEqual(result);

    vi.mocked(api.commands.run).mockRejectedValueOnce(new Error("run failed"));
    await actions.run(command.id);
    expect(output.value).toBeUndefined();
    expect(commands.runErrors[command.id]).toBe("run failed");
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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
