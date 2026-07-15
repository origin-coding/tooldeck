import path from "node:path";

import { TooldeckError } from "@tooldeck/shared";

export const PLUGIN_MANAGEMENT_STAGING_DIR = ".staging";

export function resolveInstalledPluginDir(installedPluginsDir: string, pluginId: string): string {
  const root = path.resolve(installedPluginsDir);
  const target = path.resolve(root, pluginId);

  assertContainedChildPath(root, target, pluginId);

  return target;
}

export function assertExpectedInstalledPluginDir(options: {
  installDir: string;
  installedPluginsDir: string;
  pluginId: string;
}): string {
  const expected = resolveInstalledPluginDir(options.installedPluginsDir, options.pluginId);
  const actual = path.resolve(options.installDir);

  if (actual !== expected) {
    throw new TooldeckError({
      code: "ERR_INVALID_ARGUMENT",
      message: `Installed plugin path does not match its managed location: ${options.pluginId}`,
      details: {
        pluginId: options.pluginId,
        installDir: actual,
        expectedInstallDir: expected,
      },
    });
  }

  return actual;
}

export function resolvePluginManagementStagingDir(
  installedPluginsDir: string,
  operationId: string,
): string {
  const stagingRoot = path.resolve(installedPluginsDir, PLUGIN_MANAGEMENT_STAGING_DIR);
  const target = path.resolve(stagingRoot, operationId);

  assertContainedChildPath(stagingRoot, target, operationId);

  return target;
}

function assertContainedChildPath(root: string, target: string, value: string): void {
  const relative = path.relative(root, target);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new TooldeckError({
      code: "ERR_INVALID_ARGUMENT",
      message: `Plugin management path escapes its configured root: ${value}`,
      details: {
        root,
        target,
        value,
      },
    });
  }
}
