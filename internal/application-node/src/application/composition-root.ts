import { createRuntime, type CreatedRuntime } from "@tooldeck/runtime-node";
import { Effect } from "effect";

import {
  type ApplicationConfiguration,
  normalizeApplicationConfiguration,
} from "@/application/configuration";
import type { ApplicationEffect } from "@/application/effect";
import { tryApplicationSync } from "@/application/effect";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import {
  type ApplicationDatabaseServices,
  type ApplicationRuntimeDependencies,
  ApplicationResourceOwner,
} from "@/application/resource-owner";
import type { RuntimeService } from "@/application/runtime-context";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { ApplicationCommands } from "@/commands/application-commands";
import { makeCommandsService } from "@/commands/commands-live";
import { ApplicationHistory } from "@/history/application-history";
import { makeHistoryService } from "@/history/history-live";
import { ApplicationPlugins } from "@/plugins/application-plugins";
import { PluginManagementService } from "@/plugins/management";
import { makePluginsService } from "@/plugins/plugins-live";
import { ApplicationPreferences } from "@/preferences/application-preferences";
import { makePreferencesService } from "@/preferences/preferences-live";
import type { PluginKvRepository, TooldeckDatabase } from "@/storage";
import { makeApplicationStorageService } from "@/storage/storage-live";

export interface ApplicationFacades {
  readonly commands: ApplicationCommands;
  readonly plugins: ApplicationPlugins;
  readonly preferences: ApplicationPreferences;
  readonly history: ApplicationHistory;
}

export interface TooldeckApplicationComposition {
  readonly configuration: ApplicationConfiguration;
  readonly lifecycle: ApplicationLifecycleCoordinator;
  readonly facades: ApplicationFacades;
}

export function composeTooldeckApplication(
  options: CreateTooldeckApplicationOptions = {},
): TooldeckApplicationComposition {
  const configuration = normalizeApplicationConfiguration(options);
  const resources = createApplicationResourceOwner(configuration);
  const lifecycle = new ApplicationLifecycleCoordinator(resources);

  return {
    configuration,
    lifecycle,
    facades: createApplicationFacades(configuration, resources),
  };
}

function createApplicationResourceOwner(
  configuration: ApplicationConfiguration,
): ApplicationResourceOwner {
  return new ApplicationResourceOwner({
    paths: configuration.paths,
    createDatabaseServices: (database) =>
      createApplicationDatabaseServices(configuration, database),
    createRuntime: (dependencies) => createApplicationRuntime(configuration, dependencies),
  });
}

function createApplicationDatabaseServices(
  configuration: ApplicationConfiguration,
  database: TooldeckDatabase,
): ApplicationDatabaseServices {
  const storage = makeApplicationStorageService(database);

  return {
    ...storage,
    pluginManagement: new PluginManagementService({
      installedPluginsDir: configuration.paths.installedPluginsDir,
      pluginSources: configuration.pluginSources,
      repositories: storage.repositories,
      withImmediateTransaction: storage.withImmediateTransaction,
    }),
  };
}

function createApplicationRuntime(
  configuration: ApplicationConfiguration,
  dependencies: ApplicationRuntimeDependencies,
): ApplicationEffect<CreatedRuntime> {
  return createRuntime({
    pluginSources: configuration.pluginSources,
    parentScope: dependencies.parentScope,
    coercion: configuration.commandInputCoercion,
    createPluginStorage: (pluginId) => createPluginStorage(dependencies.pluginKv, pluginId),
    afterScan({ manifestIndex }) {
      dependencies.pluginManagement.syncCatalog(manifestIndex);
    },
  });
}

function createApplicationFacades(
  configuration: ApplicationConfiguration,
  resources: ApplicationResourceOwner,
): ApplicationFacades {
  const runtime = makeResourceOwnerRuntimeService(resources);
  const getStorage = () => tryApplicationSync(() => resources.requireStorage());
  const commandsService = makeCommandsService({
    runtime,
    getStorage,
    preprocessInput: configuration.preprocessCommandInput,
  });
  const commands = new ApplicationCommands(commandsService);
  const preferences = makePreferencesService(() =>
    getStorage().pipe(Effect.map((storage) => storage.repositories.preferences)),
  );
  const plugins = makePluginsService({
    runtime,
    getStorage,
    getPluginManagement: () => tryApplicationSync(() => resources.requirePluginManagement()),
    commands: commandsService,
  });

  return {
    commands,
    plugins: new ApplicationPlugins(plugins),
    preferences: new ApplicationPreferences(preferences),
    history: new ApplicationHistory(
      makeHistoryService(() =>
        getStorage().pipe(Effect.map((storage) => storage.repositories.commandRuns)),
      ),
    ),
  };
}

function makeResourceOwnerRuntimeService(resources: ApplicationResourceOwner): RuntimeService {
  return {
    current: () => tryApplicationSync(() => resources.requireRuntime()),
    rebuild: () => resources.rebuildRuntime(),
    dispose: () => resources.disposeRuntime(),
  };
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
