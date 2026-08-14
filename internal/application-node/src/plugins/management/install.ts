import path from "node:path";

import { unpackTooldeckPackage } from "@tooldeck/plugin-package";
import { scanPluginDirectory } from "@tooldeck/runtime-node";
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
  createApplicationCleanupError,
} from "@/errors/cleanup";
import { ApplicationError } from "@/errors/error";
import { scanAndSyncPluginCatalog } from "@/plugins/management/catalog";
import type { PluginManagementContext } from "@/plugins/management/context";
import { movePath, pathExists, removePath } from "@/plugins/management/filesystem";
import {
  closeInstallStagingScope,
  makeInstallStagingScope,
  type InstallStagingScope,
} from "@/plugins/management/install-scope";
import { captureOperationFailureEffect } from "@/plugins/management/operation-rollback";
import { resolveInstalledPluginDir } from "@/plugins/management/paths";
import type { InstalledPluginSummary } from "@/plugins/management/types";
import type { PluginInstallRow } from "@/storage";

interface InstallMutationState {
  pluginId?: string;
  finalInstallDir?: string;
  createdInstall?: PluginInstallRow;
  moveAttempted: boolean;
}

type RestoreInterruptibility = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;

export function installPluginPackage(
  context: PluginManagementContext,
  packagePath: string,
): ApplicationEffect<InstalledPluginSummary> {
  return Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      const stagingScope = yield* makeInstallStagingScope(context.installedPluginsDir);
      const mutationState: InstallMutationState = { moveAttempted: false };
      const installExit = yield* Effect.exit(
        executeInstall(context, packagePath, stagingScope, mutationState, restore),
      );
      const cleanupFailures: CapturedApplicationCleanupFailure[] = [];

      if (Exit.isFailure(installExit)) {
        yield* rollbackInstall(context, mutationState, cleanupFailures);
      }

      cleanupFailures.push(...(yield* closeInstallStagingScope(stagingScope, installExit)));

      if (Exit.isFailure(installExit)) {
        const primaryError = applicationErrorFromCause(installExit.cause);

        if (cleanupFailures.length > 0) {
          return yield* Effect.fail(
            combinePrimaryAndCleanupFailures(
              primaryError,
              cleanupFailures,
              "Plugin installation failed and cleanup or rollback did not complete.",
            ),
          );
        }

        return yield* Effect.fail(primaryError);
      }

      if (cleanupFailures.length > 0) {
        return yield* Effect.fail(
          createApplicationCleanupError(
            "Plugin installation completed but staging cleanup failed.",
            cleanupFailures,
          ),
        );
      }

      return installExit.value;
    }),
  );
}

function executeInstall(
  context: PluginManagementContext,
  packagePath: string,
  stagingScope: InstallStagingScope,
  mutationState: InstallMutationState,
  restore: RestoreInterruptibility,
): ApplicationEffect<InstalledPluginSummary> {
  return Effect.gen(function* () {
    const packageSummary = yield* tryApplicationPromise(async () =>
      unpackTooldeckPackage({
        packagePath,
        destinationDir: stagingScope.stagingDir,
      }),
    );
    yield* interruptCheckpoint(restore);

    const pluginId = packageSummary.pluginManifest.id;

    stagingScope.pluginId = pluginId;
    mutationState.pluginId = pluginId;

    if (packageSummary.pluginManifest.runtime.kind !== "node") {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_INVALID_ARGUMENT",
          message: `Unsupported installed plugin runtime: ${packageSummary.pluginManifest.runtime.kind}`,
          details: {
            pluginId,
            packagePath: packageSummary.packagePath,
            runtimeKind: packageSummary.pluginManifest.runtime.kind,
          },
        }),
      );
    }

    const finalInstallDir = resolveInstalledPluginDir(context.installedPluginsDir, pluginId);
    mutationState.finalInstallDir = finalInstallDir;

    yield* validateInstallDestination(
      context,
      packageSummary.packagePath,
      pluginId,
      finalInstallDir,
    );
    yield* interruptCheckpoint(restore);

    const currentCatalog = yield* scanAndSyncPluginCatalog(context);
    yield* interruptCheckpoint(restore);

    yield* tryApplicationPromise(async () =>
      scanPluginDirectory({
        pluginsRoot: stagingScope.stagingDir,
        kind: "installed",
        manifestIndex: currentCatalog.manifestIndex,
      }),
    );
    yield* interruptCheckpoint(restore);

    mutationState.moveAttempted = true;
    yield* tryApplicationPromise(async () => movePath(stagingScope.stagingDir, finalInstallDir));
    yield* interruptCheckpoint(restore);

    const createdInstall = yield* tryApplicationSync(() =>
      context.installs.create({
        pluginId,
        version: packageSummary.pluginManifest.version,
        installDir: finalInstallDir,
        manifestPath: path.join(finalInstallDir, "manifest.json"),
        packageName: path.basename(packageSummary.packagePath),
        packageDigest: packageSummary.packageDigest,
        packageSizeBytes: packageSummary.packageSizeBytes,
      }),
    );
    mutationState.createdInstall = createdInstall;
    yield* interruptCheckpoint(restore);

    const updatedCatalog = yield* scanAndSyncPluginCatalog(context);
    yield* interruptCheckpoint(restore);
    const plugin = updatedCatalog.plugins.find((entry) => entry.id === pluginId);

    if (!plugin || plugin.sourceKind !== "installed") {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_NOT_FOUND",
          message: `Installed plugin was not found after catalog refresh: ${pluginId}`,
          details: {
            pluginId,
            installDir: finalInstallDir,
          },
        }),
      );
    }

    return { install: createdInstall, plugin };
  });
}

function interruptCheckpoint(restore: RestoreInterruptibility): Effect.Effect<void> {
  return restore(Effect.yieldNow());
}

function validateInstallDestination(
  context: PluginManagementContext,
  packagePath: string,
  pluginId: string,
  finalInstallDir: string,
): ApplicationEffect<void> {
  return Effect.gen(function* () {
    const existingInstall = yield* tryApplicationSync(() => context.installs.getById(pluginId));

    if (existingInstall) {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_ALREADY_EXISTS",
          message: `Plugin is already installed: ${pluginId}`,
          details: {
            pluginId,
            existingInstallDir: existingInstall.installDir,
            packagePath,
          },
        }),
      );
    }

    if (yield* tryApplicationPromise(async () => pathExists(finalInstallDir))) {
      return yield* Effect.fail(
        new ApplicationError({
          source: "application",
          code: "ERR_ALREADY_EXISTS",
          message: `Installed plugin directory already exists: ${pluginId}`,
          details: {
            pluginId,
            installDir: finalInstallDir,
            packagePath,
          },
        }),
      );
    }
  });
}

function rollbackInstall(
  context: PluginManagementContext,
  mutationState: InstallMutationState,
  cleanupFailures: CapturedApplicationCleanupFailure[],
): ApplicationEffect<void> {
  return Effect.gen(function* () {
    if (mutationState.createdInstall) {
      const pluginId = mutationState.createdInstall.pluginId;

      yield* captureOperationFailureEffect(
        tryApplicationSync(() => context.installs.delete(pluginId)),
        cleanupFailures,
        (error) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginInstall.delete",
            context: { pluginId },
            error,
          }),
      );
    }

    if (mutationState.moveAttempted && mutationState.finalInstallDir && mutationState.pluginId) {
      const pluginId = mutationState.pluginId;

      yield* captureOperationFailureEffect(
        tryApplicationPromise(async () => removePath(mutationState.finalInstallDir!)),
        cleanupFailures,
        (error) =>
          captureApplicationCleanupFailure({
            phase: "rollback",
            step: "pluginDirectory.remove",
            context: { pluginId },
            error,
          }),
      );
    }

    const pluginId = mutationState.createdInstall?.pluginId ?? mutationState.pluginId;

    if ((mutationState.moveAttempted || mutationState.createdInstall) && pluginId) {
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
