import { mkdir } from "node:fs/promises";

import { createRuntime } from "@tooldeck/runtime-node";
import { Effect, Layer } from "effect";

import type { ApplicationConfiguration } from "@/application/configuration";
import type { ApplicationFailure } from "@/application/effect";
import { tryApplicationPromise } from "@/application/effect";
import { makeRuntimeLive } from "@/application/runtime-live";
import type { ApplicationServices } from "@/application/services";
import { makeCommandsLive } from "@/commands/commands-live";
import type { CapturedApplicationCleanupFailure } from "@/errors/application-cleanup";
import { makeHistoryLive } from "@/history/history-live";
import { syncPluginRepository } from "@/plugins/management/catalog";
import { makePluginsLive } from "@/plugins/plugins-live";
import { makePreferencesLive } from "@/preferences/preferences-live";
import { ApplicationStorage } from "@/storage/context";
import type { PluginKvRepository } from "@/storage/repositories";
import { makeStorageLive } from "@/storage/storage-live";

export function makeApplicationLayer(
  configuration: ApplicationConfiguration,
  onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
): Layer.Layer<ApplicationServices, ApplicationFailure> {
  const storage = makeStorageLive({
    path: configuration.paths.databasePath,
    onCleanupFailure,
  });
  const runtime = makeRuntimeLayer(configuration, onCleanupFailure).pipe(Layer.provide(storage));
  const infrastructure = Layer.merge(storage, runtime);
  const commands = makeCommandsLive({
    preprocessInput: configuration.preprocessCommandInput,
  }).pipe(Layer.provide(infrastructure));
  const preferences = makePreferencesLive().pipe(Layer.provide(infrastructure));
  const history = makeHistoryLive().pipe(Layer.provide(infrastructure));
  const plugins = makePluginsLive({
    installedPluginsDir: configuration.paths.installedPluginsDir,
    pluginSources: configuration.pluginSources,
  }).pipe(Layer.provide(Layer.merge(infrastructure, commands)));

  return Layer.mergeAll(commands, plugins, preferences, history);
}

function makeRuntimeLayer(
  configuration: ApplicationConfiguration,
  onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
) {
  return Layer.unwrapEffect(
    Effect.gen(function* () {
      const storage = yield* ApplicationStorage;

      return makeRuntimeLive({
        createRuntime: () =>
          Effect.gen(function* () {
            yield* tryApplicationPromise(async () => {
              await mkdir(configuration.paths.installedPluginsDir, { recursive: true });
              await mkdir(configuration.paths.userPluginsDir, { recursive: true });
            });

            return yield* createRuntime({
              pluginSources: configuration.pluginSources,
              coercion: configuration.commandInputCoercion,
              createPluginStorage: (pluginId) =>
                createPluginStorage(storage.repositories.pluginKv, pluginId),
              afterScan({ manifestIndex }) {
                syncPluginRepository(storage.repositories.plugins, manifestIndex);
              },
            });
          }),
        onCleanupFailure,
      });
    }),
  );
}

function createPluginStorage(pluginKv: PluginKvRepository, pluginId: string) {
  return {
    async get(key: string) {
      return pluginKv.get(pluginId, key);
    },
    async set(key: string, value: unknown) {
      pluginKv.set({ pluginId, key, value });
    },
    async delete(key: string) {
      pluginKv.delete(pluginId, key);
    },
  };
}
