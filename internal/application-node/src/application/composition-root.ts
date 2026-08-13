import { makeApplicationLayer } from "@/application/application-layer";
import { ApplicationLayerOwner } from "@/application/application-layer-owner";
import type { ApplicationConfiguration } from "@/application/configuration";
import { normalizeApplicationConfiguration } from "@/application/configuration";
import { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import type { CreateTooldeckApplicationOptions } from "@/application/types";
import { ApplicationCommands } from "@/commands/application-commands";
import { Commands, type CommandsService } from "@/commands/context";
import { ApplicationHistory } from "@/history/application-history";
import { History, type HistoryService } from "@/history/context";
import { ApplicationPlugins } from "@/plugins/application-plugins";
import { Plugins, type PluginsService } from "@/plugins/context";
import { ApplicationPreferences } from "@/preferences/application-preferences";
import { Preferences, type PreferencesService } from "@/preferences/context";

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
  const owner = new ApplicationLayerOwner({
    makeLayer: (onCleanupFailure) => makeApplicationLayer(configuration, onCleanupFailure),
  });

  return {
    configuration,
    lifecycle: new ApplicationLifecycleCoordinator(owner),
    facades: createApplicationFacades(owner),
  };
}

function createApplicationFacades(owner: ApplicationLayerOwner): ApplicationFacades {
  return {
    commands: new ApplicationCommands(proxyCommands(owner)),
    plugins: new ApplicationPlugins(proxyPlugins(owner)),
    preferences: new ApplicationPreferences(proxyPreferences(owner)),
    history: new ApplicationHistory(proxyHistory(owner)),
  };
}

function proxyCommands(owner: ApplicationLayerOwner): CommandsService {
  return {
    list: (request) => owner.use(Commands, "runtime", (service) => service.list(request)),
    run: (request) => owner.use(Commands, "runtime", (service) => service.run(request)),
  };
}

function proxyPlugins(owner: ApplicationLayerOwner): PluginsService {
  return {
    list: (request) => owner.use(Plugins, "runtime", (service) => service.list(request)),
    rescan: (request) => owner.use(Plugins, "runtime", (service) => service.rescan(request)),
    setEnabled: (pluginId, enabled, request) =>
      owner.use(Plugins, "runtime", (service) => service.setEnabled(pluginId, enabled, request)),
    installPackage: (packagePath, request) =>
      owner.use(Plugins, "runtime", (service) => service.installPackage(packagePath, request)),
    uninstall: (pluginId, request) =>
      owner.use(Plugins, "runtime", (service) => service.uninstall(pluginId, request)),
    listDataResidues: () => owner.use(Plugins, "runtime", (service) => service.listDataResidues()),
    purgeData: (pluginId) =>
      owner.use(Plugins, "runtime", (service) => service.purgeData(pluginId)),
  };
}

function proxyPreferences(owner: ApplicationLayerOwner): PreferencesService {
  return {
    list: (request) => owner.use(Preferences, "preferences", (service) => service.list(request)),
    get: (request) => owner.use(Preferences, "preferences", (service) => service.get(request)),
    set: (request) => owner.use(Preferences, "preferences", (service) => service.set(request)),
    delete: (request) =>
      owner.use(Preferences, "preferences", (service) => service.delete(request)),
  };
}

function proxyHistory(owner: ApplicationLayerOwner): HistoryService {
  return {
    listCommandRuns: (request) =>
      owner.use(History, "command history", (service) => service.listCommandRuns(request)),
  };
}
