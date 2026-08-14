import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Effect, Exit } from "effect";

import {
  applicationErrorFromCause,
  type ApplicationEffect,
  tryApplicationPromise,
  tryApplicationSync,
} from "@/application/effect";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
} from "@/errors/cleanup";
import { ApplicationError } from "@/errors/error";
import { scanAndSyncPluginCatalog } from "@/plugins/management/catalog";
import type { PluginManagementContext } from "@/plugins/management/context";
import { movePath, pathExists, removePath, tryLstat } from "@/plugins/management/filesystem";
import { captureOperationFailureEffect } from "@/plugins/management/operation-rollback";
import {
  assertExpectedInstalledPluginDir,
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolvePluginManagementStagingDir,
} from "@/plugins/management/paths";
import type { UninstalledPluginSummary } from "@/plugins/management/types";
import type { CreatePluginInstallInput, PluginInstallRow } from "@/storage";

interface UninstallMutationState {
  readonly install: PluginInstallRow;
  readonly installDir: string;
  readonly quarantineDir: string;
  readonly stagingEntry: string;
  readonly filesMissing: boolean;
  movedToQuarantine: boolean;
  deletedInstall: boolean;
}

export function uninstallPlugin(
  context: PluginManagementContext,
  pluginId: string,
): ApplicationEffect<UninstalledPluginSummary> {
  return Effect.uninterruptible(
    Effect.gen(function* () {
      const state = yield* prepareUninstall(context, pluginId);
      const uninstallExit = yield* Effect.exit(executeUninstall(context, pluginId, state));
      const cleanupFailures: CapturedApplicationCleanupFailure[] = [];

      if (Exit.isFailure(uninstallExit)) {
        yield* rollbackUninstall(context, pluginId, state, cleanupFailures);
        const primaryError = applicationErrorFromCause(uninstallExit.cause);

        return yield* Effect.fail(
          cleanupFailures.length > 0
            ? combinePrimaryAndCleanupFailures(
                primaryError,
                cleanupFailures,
                "Plugin uninstall failed and cleanup or rollback did not complete.",
              )
            : primaryError,
        );
      }

      if (state.movedToQuarantine) {
        yield* captureOperationFailureEffect(
          tryApplicationPromise(async () => removePath(state.quarantineDir)),
          cleanupFailures,
          (error) =>
            captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "pluginQuarantine.remove",
              context: { pluginId, stagingEntry: state.stagingEntry },
              error,
            }),
        );
      }

      return {
        cleanupFailures: cleanupFailures.map((failure) => failure.diagnostic),
        cleanupPending: cleanupFailures.length > 0,
        filesMissing: state.filesMissing,
        install: state.install,
        pluginId,
      };
    }),
  );
}

function prepareUninstall(
  context: PluginManagementContext,
  pluginId: string,
): ApplicationEffect<UninstallMutationState> {
  return Effect.gen(function* () {
    const install = yield* tryApplicationSync(() => context.installs.getById(pluginId));

    if (!install) {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_NOT_FOUND",
          message: `Plugin is not installed: ${pluginId}`,
          details: { pluginId },
        }),
      );
    }

    const installDir = yield* tryApplicationSync(() =>
      assertExpectedInstalledPluginDir({
        installDir: install.installDir,
        installedPluginsDir: context.installedPluginsDir,
        pluginId,
      }),
    );
    const installStat = yield* tryApplicationPromise(async () => tryLstat(installDir));

    if (installStat && (!installStat.isDirectory() || installStat.isSymbolicLink())) {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_INVALID_ARGUMENT",
          message: `Installed plugin path is not a managed directory: ${pluginId}`,
          details: { pluginId, installDir },
        }),
      );
    }

    yield* tryApplicationPromise(async () =>
      mkdir(path.join(context.installedPluginsDir, PLUGIN_MANAGEMENT_STAGING_DIR), {
        recursive: true,
      }),
    );

    const quarantineDir = resolvePluginManagementStagingDir(
      context.installedPluginsDir,
      `uninstall-${randomUUID()}`,
    );

    return {
      install,
      installDir,
      quarantineDir,
      stagingEntry: path.basename(quarantineDir),
      filesMissing: !installStat,
      movedToQuarantine: false,
      deletedInstall: false,
    };
  });
}

function executeUninstall(
  context: PluginManagementContext,
  pluginId: string,
  state: UninstallMutationState,
): ApplicationEffect<void> {
  return Effect.gen(function* () {
    if (!state.filesMissing) {
      yield* tryApplicationPromise(async () => movePath(state.installDir, state.quarantineDir));
      state.movedToQuarantine = true;
    }

    const deleted = yield* tryApplicationSync(() => context.installs.delete(pluginId));

    if (!deleted) {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_NOT_FOUND",
          message: `Plugin install record disappeared during uninstall: ${pluginId}`,
          details: { pluginId },
        }),
      );
    }

    state.deletedInstall = true;
    yield* scanAndSyncPluginCatalog(context);
  });
}

function rollbackUninstall(
  context: PluginManagementContext,
  pluginId: string,
  state: UninstallMutationState,
  cleanupFailures: CapturedApplicationCleanupFailure[],
): ApplicationEffect<void> {
  return Effect.gen(function* () {
    if (
      state.movedToQuarantine &&
      (yield* tryApplicationPromise(async () => pathExists(state.quarantineDir)))
    ) {
      yield* captureOperationFailureEffect(
        tryApplicationPromise(async () => movePath(state.quarantineDir, state.installDir)),
        cleanupFailures,
        (error) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginDirectory.restore",
            context: { pluginId, stagingEntry: state.stagingEntry },
            error,
          }),
      );
    }

    if (state.deletedInstall && !context.installs.getById(pluginId)) {
      yield* captureOperationFailureEffect(
        tryApplicationSync(() =>
          context.installs.create(toCreatePluginInstallInput(state.install)),
        ),
        cleanupFailures,
        (error) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginInstall.restore",
            context: { pluginId },
            error,
          }),
      );
    }

    if (state.movedToQuarantine || state.deletedInstall) {
      yield* captureOperationFailureEffect(
        scanAndSyncPluginCatalog(context),
        cleanupFailures,
        (error) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginCatalog.restore",
            context: { pluginId },
            error,
          }),
      );
    }
  });
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
