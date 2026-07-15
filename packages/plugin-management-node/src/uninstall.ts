import { randomUUID } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import path from "node:path";

import { TooldeckError } from "@tooldeck/shared";
import type { CreatePluginInstallInput, PluginInstallRow } from "@tooldeck/storage";

import { scanAndSyncPluginCatalog } from "./catalog";
import { pathExists, removePath, tryLstat } from "./filesystem";
import type { PluginManagementContext } from "./internal";
import { captureRollbackError, throwOperationFailure } from "./operation-rollback";
import {
  assertExpectedInstalledPluginDir,
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolvePluginManagementStagingDir,
} from "./paths";
import type { UninstalledPluginSummary } from "./types";

export async function uninstallPlugin(
  context: PluginManagementContext,
  pluginId: string,
): Promise<UninstalledPluginSummary> {
  const install = context.installs.getById(pluginId);

  if (!install) {
    throw new TooldeckError({
      code: "ERR_NOT_FOUND",
      message: `Plugin is not installed: ${pluginId}`,
      details: { pluginId },
    });
  }

  const installDir = assertExpectedInstalledPluginDir({
    installDir: install.installDir,
    installedPluginsDir: context.installedPluginsDir,
    pluginId,
  });
  const installStat = await tryLstat(installDir);

  if (installStat && (!installStat.isDirectory() || installStat.isSymbolicLink())) {
    throw new TooldeckError({
      code: "ERR_INVALID_ARGUMENT",
      message: `Installed plugin path is not a managed directory: ${pluginId}`,
      details: {
        pluginId,
        installDir,
      },
    });
  }

  await mkdir(path.join(context.installedPluginsDir, PLUGIN_MANAGEMENT_STAGING_DIR), {
    recursive: true,
  });

  const quarantineDir = resolvePluginManagementStagingDir(
    context.installedPluginsDir,
    `uninstall-${randomUUID()}`,
  );
  const filesMissing = !installStat;
  let movedToQuarantine = false;
  let deletedInstall = false;

  try {
    if (!filesMissing) {
      await rename(installDir, quarantineDir);
      movedToQuarantine = true;
    }

    const deleted = context.installs.delete(pluginId);

    if (!deleted) {
      throw new TooldeckError({
        code: "ERR_NOT_FOUND",
        message: `Plugin install record disappeared during uninstall: ${pluginId}`,
        details: { pluginId },
      });
    }

    deletedInstall = true;
    await scanAndSyncPluginCatalog(context);
  } catch (error) {
    const rollbackErrors: string[] = [];

    if (movedToQuarantine && (await pathExists(quarantineDir))) {
      await captureRollbackError(
        () => rename(quarantineDir, installDir),
        "restore installed plugin directory",
        rollbackErrors,
      );
    }

    if (deletedInstall && !context.installs.getById(pluginId)) {
      await captureRollbackError(
        () => context.installs.create(toCreatePluginInstallInput(install)),
        "restore plugin install record",
        rollbackErrors,
      );
    }

    if (movedToQuarantine || deletedInstall) {
      await captureRollbackError(
        () => scanAndSyncPluginCatalog(context),
        "restore plugin catalog",
        rollbackErrors,
      );
    }

    throwOperationFailure("Plugin uninstall", error, rollbackErrors);
  }

  let cleanupError: string | undefined;

  if (movedToQuarantine) {
    try {
      await removePath(quarantineDir);
    } catch (error) {
      cleanupError = formatUnknownError(error);
    }
  }

  return {
    ...(cleanupError ? { cleanupError } : {}),
    cleanupPending: cleanupError !== undefined,
    filesMissing,
    install,
    pluginId,
  };
}

function toCreatePluginInstallInput(install: PluginInstallRow): CreatePluginInstallInput {
  return {
    pluginId: install.pluginId,
    version: install.version,
    installDir: install.installDir,
    manifestPath: install.manifestPath,
    packageName: install.packageName,
    packageDigest: install.packageDigest,
    packageSizeBytes: install.packageSizeBytes,
    installedAt: install.installedAt,
    updatedAt: install.updatedAt,
  };
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
