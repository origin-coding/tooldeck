import { describe, expect, it } from "vitest";

import { resolvePluginDataDir, resolveTooldeckPaths } from "../src";

describe("resolveTooldeckPaths", () => {
  it("resolves Windows app data paths from APPDATA and LOCALAPPDATA", () => {
    const paths = resolveTooldeckPaths({
      platform: "win32",
      homeDir: "C:\\Users\\alice",
      tempDir: "C:\\Users\\alice\\AppData\\Local\\Temp",
      env: {
        APPDATA: "C:\\Users\\alice\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\alice\\AppData\\Local",
      },
    });

    expect(paths).toMatchObject({
      userConfigDir: "C:\\Users\\alice\\AppData\\Roaming\\tooldeck",
      userDataDir: "C:\\Users\\alice\\AppData\\Local\\tooldeck",
      databasePath: "C:\\Users\\alice\\AppData\\Local\\tooldeck\\tooldeck.sqlite",
      userPluginsDir: "C:\\Users\\alice\\AppData\\Local\\tooldeck\\plugins",
      pluginDataDir: "C:\\Users\\alice\\AppData\\Local\\tooldeck\\plugin-data",
      cacheDir: "C:\\Users\\alice\\AppData\\Local\\tooldeck\\cache",
      logsDir: "C:\\Users\\alice\\AppData\\Local\\tooldeck\\logs",
      tempDir: "C:\\Users\\alice\\AppData\\Local\\Temp\\tooldeck",
    });
  });

  it("resolves macOS Application Support, Caches, and Logs paths", () => {
    const paths = resolveTooldeckPaths({
      platform: "darwin",
      homeDir: "/Users/alice",
      tempDir: "/var/folders/tmp",
      env: {},
    });

    expect(paths).toMatchObject({
      userConfigDir: "/Users/alice/Library/Application Support/tooldeck",
      userDataDir: "/Users/alice/Library/Application Support/tooldeck",
      databasePath: "/Users/alice/Library/Application Support/tooldeck/tooldeck.sqlite",
      userPluginsDir: "/Users/alice/Library/Application Support/tooldeck/plugins",
      pluginDataDir: "/Users/alice/Library/Application Support/tooldeck/plugin-data",
      cacheDir: "/Users/alice/Library/Caches/tooldeck",
      logsDir: "/Users/alice/Library/Logs/tooldeck",
      tempDir: "/var/folders/tmp/tooldeck",
    });
  });

  it("resolves Linux XDG paths with fallbacks", () => {
    const paths = resolveTooldeckPaths({
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      env: {},
    });

    expect(paths).toMatchObject({
      userConfigDir: "/home/alice/.config/tooldeck",
      userDataDir: "/home/alice/.local/share/tooldeck",
      databasePath: "/home/alice/.local/share/tooldeck/tooldeck.sqlite",
      userPluginsDir: "/home/alice/.local/share/tooldeck/plugins",
      pluginDataDir: "/home/alice/.local/share/tooldeck/plugin-data",
      cacheDir: "/home/alice/.cache/tooldeck",
      logsDir: "/home/alice/.local/state/tooldeck/logs",
      tempDir: "/tmp/tooldeck",
    });
  });

  it("uses XDG environment variables on Linux when present", () => {
    const paths = resolveTooldeckPaths({
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      env: {
        XDG_CONFIG_HOME: "/xdg/config",
        XDG_DATA_HOME: "/xdg/data",
        XDG_CACHE_HOME: "/xdg/cache",
        XDG_STATE_HOME: "/xdg/state",
      },
    });

    expect(paths).toMatchObject({
      userConfigDir: "/xdg/config/tooldeck",
      userDataDir: "/xdg/data/tooldeck",
      cacheDir: "/xdg/cache/tooldeck",
      logsDir: "/xdg/state/tooldeck/logs",
    });
  });

  it("uses workspace plugins as builtin plugins in development mode", () => {
    const paths = resolveTooldeckPaths({
      mode: "development",
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      workspaceRoot: "/work/tooldeck",
      env: {},
    });

    expect(paths.builtinPluginsDir).toBe("/work/tooldeck/plugins");
  });

  it("uses appInstallDir plugins as builtin plugins in production mode", () => {
    const paths = resolveTooldeckPaths({
      mode: "production",
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      appInstallDir: "/opt/tooldeck",
      env: {},
    });

    expect(paths.appInstallDir).toBe("/opt/tooldeck");
    expect(paths.builtinPluginsDir).toBe("/opt/tooldeck/plugins");
  });

  it("applies defined overrides without allowing undefined to clear defaults", () => {
    const paths = resolveTooldeckPaths({
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      env: {},
      overrides: {
        databasePath: "/custom/tooldeck.sqlite",
        cacheDir: undefined,
      },
    });

    expect(paths.databasePath).toBe("/custom/tooldeck.sqlite");
    expect(paths.cacheDir).toBe("/home/alice/.cache/tooldeck");
  });

  it("resolves per-plugin data directories under pluginDataDir", () => {
    const paths = resolveTooldeckPaths({
      platform: "linux",
      homeDir: "/home/alice",
      tempDir: "/tmp",
      env: {},
    });

    expect(resolvePluginDataDir(paths, "dev.example.json-tools")).toBe(
      "/home/alice/.local/share/tooldeck/plugin-data/dev.example.json-tools",
    );
  });
});
