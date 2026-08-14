import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Effect, ExecutionStrategy, Exit, Scope } from "effect";

import { type ApplicationEffect, tryApplicationPromise } from "@/application/effect";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
} from "@/errors/cleanup";
import { removePath } from "@/plugins/management/filesystem";
import {
  PLUGIN_MANAGEMENT_STAGING_DIR,
  resolvePluginManagementStagingDir,
} from "@/plugins/management/paths";

export interface InstallStagingScope {
  readonly scope: Scope.CloseableScope;
  readonly stagingDir: string;
  readonly stagingEntry: string;
  readonly cleanupFailures: CapturedApplicationCleanupFailure[];
  pluginId?: string;
}

export function makeInstallStagingScope(
  installedPluginsDir: string,
): ApplicationEffect<InstallStagingScope> {
  return Effect.gen(function* () {
    yield* tryApplicationPromise(async () =>
      mkdir(path.join(installedPluginsDir, PLUGIN_MANAGEMENT_STAGING_DIR), {
        recursive: true,
      }),
    );

    const stagingDir = resolvePluginManagementStagingDir(
      installedPluginsDir,
      `install-${randomUUID()}`,
    );
    const stagingScope: InstallStagingScope = {
      scope: yield* Scope.make(ExecutionStrategy.sequential),
      stagingDir,
      stagingEntry: path.basename(stagingDir),
      cleanupFailures: [],
    };

    yield* Scope.addFinalizer(
      stagingScope.scope,
      tryApplicationPromise(async () => removePath(stagingDir)).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            stagingScope.cleanupFailures.push(
              captureApplicationCleanupFailure({
                phase: "cleanup",
                step: "pluginStaging.remove",
                context: {
                  stagingEntry: stagingScope.stagingEntry,
                  ...(stagingScope.pluginId ? { pluginId: stagingScope.pluginId } : {}),
                },
                error,
              }),
            );
          }),
        ),
      ),
    );

    return stagingScope;
  });
}

export function closeInstallStagingScope(
  stagingScope: InstallStagingScope,
  exit: Exit.Exit<unknown, unknown>,
): Effect.Effect<CapturedApplicationCleanupFailure[]> {
  return Scope.close(stagingScope.scope, exit).pipe(
    Effect.andThen(Effect.sync(() => stagingScope.cleanupFailures.splice(0))),
  );
}
