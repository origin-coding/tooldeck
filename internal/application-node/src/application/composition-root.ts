import { createRuntime, type CreatedRuntime } from "@tooldeck/runtime-node";

import {
  type ApplicationConfiguration,
  normalizeApplicationConfiguration,
} from "@/application/configuration";
import { TooldeckApplicationContext } from "@/application/context";
import type { ApplicationEffect } from "@/application/effect";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import {
  type ApplicationDatabaseServices,
  type ApplicationRuntimeDependencies,
  ApplicationResourceOwner,
} from "@/application/resource-owner";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { ApplicationCommands } from "@/commands/application-commands";
import { ApplicationHistory } from "@/history/application-history";
import { ApplicationPlugins } from "@/plugins/application-plugins";
import { PluginManagementService } from "@/plugins/management";
import { ApplicationPreferences } from "@/preferences/application-preferences";
import {
  CommandRunRepository,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
  type TooldeckDatabase,
} from "@/storage";

export interface ApplicationFacades {
  readonly commands: ApplicationCommands;
  readonly plugins: ApplicationPlugins;
  readonly preferences: ApplicationPreferences;
  readonly history: ApplicationHistory;
}

export interface TooldeckApplicationComposition {
  readonly configuration: ApplicationConfiguration;
  readonly context: TooldeckApplicationContext;
  readonly facades: ApplicationFacades;
}

export function composeTooldeckApplication(
  options: CreateTooldeckApplicationOptions = {},
): TooldeckApplicationComposition {
  const configuration = normalizeApplicationConfiguration(options);
  const resources = createApplicationResourceOwner(configuration);
  const lifecycle = new ApplicationLifecycleCoordinator(resources);
  const context = new TooldeckApplicationContext({
    preprocessCommandInput: configuration.preprocessCommandInput,
    lifecycle,
    resources,
  });

  return {
    configuration,
    context,
    facades: createApplicationFacades(context),
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
  return {
    commandRuns: new CommandRunRepository(database.db),
    preferences: new PreferenceRepository(database.db),
    plugins: new PluginRepository(database.db),
    pluginKv: new PluginKvRepository(database.db),
    pluginManagement: new PluginManagementService({
      database,
      installedPluginsDir: configuration.paths.installedPluginsDir,
      pluginSources: configuration.pluginSources,
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

function createApplicationFacades(context: TooldeckApplicationContext): ApplicationFacades {
  const commands = new ApplicationCommands(context);

  return {
    commands,
    plugins: new ApplicationPlugins(context, commands),
    preferences: new ApplicationPreferences(context),
    history: new ApplicationHistory(context),
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
