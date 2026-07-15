import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { unpackTooldeckPackage } from "@tooldeck/plugin-package";
import { scanPluginDirectory } from "@tooldeck/runtime-node";
import { TooldeckError } from "@tooldeck/shared";
import type { PluginInstallRow } from "@tooldeck/storage";

import { scanAndSyncPluginCatalog } from "./catalog";
import { pathExists } from "./filesystem";
import type { PluginManagementContext } from "./internal";
import { captureRollbackError, throwOperationFailure } from "./operation-rollback";
import {
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolveInstalledPluginDir,
  resolvePluginManagementStagingDir,
} from "./paths";
import type { InstalledPluginSummary } from "./types";

export async function installPluginPackage(
  context: PluginManagementContext,
  packagePath: string,
): Promise<InstalledPluginSummary> {
  await mkdir(path.join(context.installedPluginsDir, PLUGIN_MANAGEMENT_STAGING_DIR), {
    recursive: true,
  });

  const stagingDir = resolvePluginManagementStagingDir(
    context.installedPluginsDir,
    `install-${randomUUID()}`,
  );
  let finalInstallDir: string | undefined;
  let createdInstall: PluginInstallRow | undefined;
  let movedToFinal = false;

  try {
    const packageSummary = await unpackTooldeckPackage({
      packagePath,
      destinationDir: stagingDir,
    });
    const pluginId = packageSummary.pluginManifest.id;

    if (packageSummary.pluginManifest.runtime.kind !== "node") {
      throw new TooldeckError({
        code: "ERR_INVALID_ARGUMENT",
        message: `Unsupported installed plugin runtime: ${packageSummary.pluginManifest.runtime.kind}`,
        details: {
          pluginId,
          packagePath: packageSummary.packagePath,
          runtimeKind: packageSummary.pluginManifest.runtime.kind,
        },
      });
    }

    finalInstallDir = resolveInstalledPluginDir(context.installedPluginsDir, pluginId);
    const existingInstall = context.installs.getById(pluginId);

    if (existingInstall) {
      throw new TooldeckError({
        code: "ERR_ALREADY_EXISTS",
        message: `Plugin is already installed: ${pluginId}`,
        details: {
          pluginId,
          existingInstallDir: existingInstall.installDir,
          packagePath: packageSummary.packagePath,
        },
      });
    }

    if (await pathExists(finalInstallDir)) {
      throw new TooldeckError({
        code: "ERR_ALREADY_EXISTS",
        message: `Installed plugin directory already exists: ${pluginId}`,
        details: {
          pluginId,
          installDir: finalInstallDir,
          packagePath: packageSummary.packagePath,
        },
      });
    }

    const currentCatalog = await scanAndSyncPluginCatalog(context);

    await scanPluginDirectory({
      pluginsRoot: stagingDir,
      kind: "installed",
      manifestIndex: currentCatalog.manifestIndex,
    });

    await rename(stagingDir, finalInstallDir);
    movedToFinal = true;

    createdInstall = context.installs.create({
      pluginId,
      version: packageSummary.pluginManifest.version,
      installDir: finalInstallDir,
      manifestPath: path.join(finalInstallDir, "manifest.json"),
      packageName: path.basename(packageSummary.packagePath),
      packageDigest: packageSummary.packageDigest,
      packageSizeBytes: packageSummary.packageSizeBytes,
    });

    const updatedCatalog = await scanAndSyncPluginCatalog(context);
    const plugin = updatedCatalog.plugins.find((entry) => entry.id === pluginId);

    if (!plugin || plugin.sourceKind !== "installed") {
      throw new TooldeckError({
        code: "ERR_NOT_FOUND",
        message: `Installed plugin was not found after catalog refresh: ${pluginId}`,
        details: {
          pluginId,
          installDir: finalInstallDir,
        },
      });
    }

    return {
      install: createdInstall,
      plugin,
    };
  } catch (error) {
    const rollbackErrors: string[] = [];

    if (createdInstall) {
      const createdPluginId = createdInstall.pluginId;

      await captureRollbackError(
        () => context.installs.delete(createdPluginId),
        "delete plugin install record",
        rollbackErrors,
      );
    }

    if (movedToFinal && finalInstallDir) {
      const rollbackInstallDir = finalInstallDir;

      await captureRollbackError(
        () => rm(rollbackInstallDir, { recursive: true, force: true }),
        "remove installed plugin directory",
        rollbackErrors,
      );
    } else {
      await captureRollbackError(
        () => rm(stagingDir, { recursive: true, force: true }),
        "remove plugin staging directory",
        rollbackErrors,
      );
    }

    if (movedToFinal || createdInstall) {
      await captureRollbackError(
        () => scanAndSyncPluginCatalog(context),
        "restore plugin catalog",
        rollbackErrors,
      );
    }

    throwOperationFailure("Plugin installation", error, rollbackErrors);
  }
}
