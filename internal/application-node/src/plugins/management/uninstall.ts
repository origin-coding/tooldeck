import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
} from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";
import { scanAndSyncPluginCatalog } from "@/plugins/management/catalog";
import { movePath, pathExists, removePath, tryLstat } from "@/plugins/management/filesystem";
import type { PluginManagementContext } from "@/plugins/management/internal";
import {
  captureOperationFailure,
  throwOperationFailure,
} from "@/plugins/management/operation-rollback";
import {
  assertExpectedInstalledPluginDir,
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolvePluginManagementStagingDir,
} from "@/plugins/management/paths";
import type { UninstalledPluginSummary } from "@/plugins/management/types";
import type { CreatePluginInstallInput, PluginInstallRow } from "@/storage";

export async function uninstallPlugin(
  context: PluginManagementContext,
  pluginId: string,
): Promise<UninstalledPluginSummary> {
  const install = context.installs.getById(pluginId);

  if (!install) {
    throw new ApplicationError({
      source: "application",
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
    throw new ApplicationError({
      source: "application",
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
  const stagingEntry = path.basename(quarantineDir);
  const filesMissing = !installStat;
  let movedToQuarantine = false;
  let deletedInstall = false;

  try {
    if (!filesMissing) {
      await movePath(installDir, quarantineDir);
      movedToQuarantine = true;
    }

    const deleted = context.installs.delete(pluginId);

    if (!deleted) {
      throw new ApplicationError({
        source: "application",
        code: "ERR_NOT_FOUND",
        message: `Plugin install record disappeared during uninstall: ${pluginId}`,
        details: { pluginId },
      });
    }

    deletedInstall = true;
    await scanAndSyncPluginCatalog(context);
  } catch (error) {
    const cleanupFailures: CapturedApplicationCleanupFailure[] = [];

    if (movedToQuarantine && (await pathExists(quarantineDir))) {
      await captureOperationFailure(
        () => movePath(quarantineDir, installDir),
        cleanupFailures,
        (rollbackError) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginDirectory.restore",
            context: { pluginId, stagingEntry },
            error: rollbackError,
          }),
      );
    }

    if (deletedInstall && !context.installs.getById(pluginId)) {
      await captureOperationFailure(
        () => context.installs.create(toCreatePluginInstallInput(install)),
        cleanupFailures,
        (rollbackError) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginInstall.restore",
            context: { pluginId },
            error: rollbackError,
          }),
      );
    }

    if (movedToQuarantine || deletedInstall) {
      await captureOperationFailure(
        () => scanAndSyncPluginCatalog(context),
        cleanupFailures,
        (rollbackError) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginCatalog.restore",
            context: { pluginId },
            error: rollbackError,
          }),
      );
    }

    throwOperationFailure("Plugin uninstall", error, cleanupFailures);
  }

  const cleanupFailures: CapturedApplicationCleanupFailure[] = [];

  if (movedToQuarantine) {
    try {
      await removePath(quarantineDir);
    } catch (error) {
      cleanupFailures.push(
        captureApplicationCleanupFailure({
          phase: "cleanup",
          step: "pluginQuarantine.remove",
          context: { pluginId, stagingEntry },
          error,
        }),
      );
    }
  }

  return {
    cleanupFailures: cleanupFailures.map((failure) => failure.diagnostic),
    cleanupPending: cleanupFailures.length > 0,
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
