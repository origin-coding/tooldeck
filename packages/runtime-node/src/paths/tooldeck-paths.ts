import os from "node:os";
import path from "node:path";

export type TooldeckRuntimeMode = "development" | "production";

export interface TooldeckPathOverrides {
  appInstallDir?: string;
  builtinPluginsDir?: string;
  userConfigDir?: string;
  userDataDir?: string;
  databasePath?: string;
  installedPluginsDir?: string;
  userPluginsDir?: string;
  pluginDataDir?: string;
  cacheDir?: string;
  logsDir?: string;
  tempDir?: string;
}

export interface ResolveTooldeckPathsOptions {
  appName?: string;
  mode?: TooldeckRuntimeMode;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  tempDir?: string;
  workspaceRoot?: string;
  appInstallDir?: string;
  overrides?: TooldeckPathOverrides;
}

export interface TooldeckPaths {
  appInstallDir?: string;
  builtinPluginsDir: string;
  userConfigDir: string;
  userDataDir: string;
  databasePath: string;
  installedPluginsDir: string;
  userPluginsDir: string;
  pluginDataDir: string;
  cacheDir: string;
  logsDir: string;
  tempDir: string;
}

export function resolveTooldeckPaths(options: ResolveTooldeckPathsOptions = {}): TooldeckPaths {
  const appName = options.appName ?? "tooldeck";
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();
  const tempRootDir = options.tempDir ?? os.tmpdir();
  const mode = options.mode ?? (options.workspaceRoot ? "development" : "production");
  const pathModule = getPathModule(platform);
  const basePaths = resolveBasePaths({
    appName,
    platform,
    env,
    homeDir,
    tempRootDir,
    pathModule,
  });
  const appInstallDir = options.appInstallDir;
  const userConfigDir = basePaths.userConfigDir;
  const userDataDir = basePaths.userDataDir;
  const cacheDir = basePaths.cacheDir;
  const logsDir = basePaths.logsDir;
  const tempDir = pathModule.join(tempRootDir, appName);
  const builtinPluginsDir =
    mode === "development" && options.workspaceRoot
      ? pathModule.join(options.workspaceRoot, "plugins")
      : pathModule.join(appInstallDir ?? userDataDir, "plugins");

  const defaults: TooldeckPaths = {
    appInstallDir,
    builtinPluginsDir,
    userConfigDir,
    userDataDir,
    databasePath: pathModule.join(userDataDir, "tooldeck.sqlite"),
    installedPluginsDir: pathModule.join(userDataDir, "installed-plugins"),
    userPluginsDir: pathModule.join(userDataDir, "plugins"),
    pluginDataDir: pathModule.join(userDataDir, "plugin-data"),
    cacheDir,
    logsDir,
    tempDir,
  };

  return applyTooldeckPathOverrides(defaults, options.overrides);
}

export function resolvePluginDataDir(paths: TooldeckPaths, pluginId: string): string {
  const pathModule = getPathModuleFromPath(paths.pluginDataDir);

  return pathModule.join(paths.pluginDataDir, pluginId);
}

function applyTooldeckPathOverrides(
  defaults: TooldeckPaths,
  overrides?: TooldeckPathOverrides,
): TooldeckPaths {
  if (!overrides) {
    return defaults;
  }

  return {
    ...defaults,
    ...withoutUndefined(overrides),
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<T>;
}

interface ResolveBasePathsOptions {
  appName: string;
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  tempRootDir: string;
  pathModule: typeof path.win32 | typeof path.posix;
}

interface ResolvedBasePaths {
  userConfigDir: string;
  userDataDir: string;
  cacheDir: string;
  logsDir: string;
}

function resolveBasePaths(options: ResolveBasePathsOptions): ResolvedBasePaths {
  switch (options.platform) {
    case "win32":
      return resolveWindowsBasePaths(options);
    case "darwin":
      return resolveMacBasePaths(options);
    default:
      return resolveLinuxBasePaths(options);
  }
}

function resolveWindowsBasePaths(options: ResolveBasePathsOptions): ResolvedBasePaths {
  const roamingAppData =
    options.env.APPDATA ?? options.pathModule.join(options.homeDir, "AppData", "Roaming");
  const localAppData =
    options.env.LOCALAPPDATA ?? options.pathModule.join(options.homeDir, "AppData", "Local");

  return {
    userConfigDir: options.pathModule.join(roamingAppData, options.appName),
    userDataDir: options.pathModule.join(localAppData, options.appName),
    cacheDir: options.pathModule.join(localAppData, options.appName, "cache"),
    logsDir: options.pathModule.join(localAppData, options.appName, "logs"),
  };
}

function resolveMacBasePaths(options: ResolveBasePathsOptions): ResolvedBasePaths {
  const applicationSupportDir = options.pathModule.join(
    options.homeDir,
    "Library",
    "Application Support",
    options.appName,
  );

  return {
    userConfigDir: applicationSupportDir,
    userDataDir: applicationSupportDir,
    cacheDir: options.pathModule.join(options.homeDir, "Library", "Caches", options.appName),
    logsDir: options.pathModule.join(options.homeDir, "Library", "Logs", options.appName),
  };
}

function resolveLinuxBasePaths(options: ResolveBasePathsOptions): ResolvedBasePaths {
  const configBaseDir =
    options.env.XDG_CONFIG_HOME ?? options.pathModule.join(options.homeDir, ".config");
  const dataBaseDir =
    options.env.XDG_DATA_HOME ?? options.pathModule.join(options.homeDir, ".local", "share");
  const cacheBaseDir =
    options.env.XDG_CACHE_HOME ?? options.pathModule.join(options.homeDir, ".cache");
  const stateBaseDir =
    options.env.XDG_STATE_HOME ?? options.pathModule.join(options.homeDir, ".local", "state");

  return {
    userConfigDir: options.pathModule.join(configBaseDir, options.appName),
    userDataDir: options.pathModule.join(dataBaseDir, options.appName),
    cacheDir: options.pathModule.join(cacheBaseDir, options.appName),
    logsDir: options.pathModule.join(stateBaseDir, options.appName, "logs"),
  };
}

function getPathModule(platform: NodeJS.Platform): typeof path.win32 | typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}

function getPathModuleFromPath(value: string): typeof path.win32 | typeof path.posix {
  return value.includes("\\") ? path.win32 : path.posix;
}
