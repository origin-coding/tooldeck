import { existsSync } from "node:fs";
import path from "node:path";

import {
  createTooldeckApplication,
  resolveTooldeckPaths,
  type ApplicationPluginSource,
  type TooldeckApplication,
  type TooldeckRuntimeMode,
} from "@tooldeck/application-node";

export interface CreateDesktopApplicationOptions {
  appInstallDir?: string;
  builtinPluginsDir?: string;
  databasePath?: string;
  externalPluginDirs?: string[];
  installedPluginsDir?: string;
  mode: TooldeckRuntimeMode;
  userDataDir?: string;
  workspaceRoot?: string;
}

export function createDesktopApplication(
  options: CreateDesktopApplicationOptions,
): TooldeckApplication {
  const workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
  const developmentDataDir = path.join(workspaceRoot, ".data");
  const userDataDir =
    options.userDataDir ?? (options.mode === "development" ? developmentDataDir : undefined);
  const paths = resolveTooldeckPaths({
    appInstallDir: options.appInstallDir,
    mode: options.mode,
    workspaceRoot,
    overrides: {
      ...(userDataDir ? { userDataDir } : {}),
      builtinPluginsDir: options.builtinPluginsDir,
      databasePath:
        options.databasePath ??
        (userDataDir ? path.join(userDataDir, "tooldeck.sqlite") : undefined),
      installedPluginsDir:
        options.installedPluginsDir ??
        (userDataDir ? path.join(userDataDir, "installed-plugins") : undefined),
      pluginDataDir: userDataDir ? path.join(userDataDir, "plugin-data") : undefined,
      userPluginsDir: userDataDir ? path.join(userDataDir, "plugins") : undefined,
    },
  });
  const pluginSources: ApplicationPluginSource[] = [
    {
      kind: "builtin",
      path: paths.builtinPluginsDir,
    },
    {
      kind: "installed",
      path: paths.installedPluginsDir,
    },
    ...(options.externalPluginDirs ?? []).map((pluginDir) => ({
      kind: "external" as const,
      path: pluginDir,
    })),
  ];

  return createTooldeckApplication({
    paths,
    pluginSources,
  });
}

function findWorkspaceRoot(): string {
  let current = process.cwd();

  for (;;) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
