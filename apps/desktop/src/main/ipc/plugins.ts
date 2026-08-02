import type { ApplicationPluginCatalog, TooldeckApplication } from "@tooldeck/application-node";

import type {
  DesktopPluginInstallResult,
  DesktopPluginUninstallResult,
  InstallPluginPackageIpcRequest,
  ListPluginsRequest,
  PurgePluginDataRequest,
  RescanPluginsRequest,
  SetPluginEnabledRequest,
  UninstallPluginRequest,
} from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopCommand, toDesktopPlugin } from "../desktop-contract/catalog";
import type { DesktopIpcRegistrar } from "./register";

export function registerPluginsIpc(
  registrar: DesktopIpcRegistrar,
  application: TooldeckApplication,
): void {
  registrar.register(desktopIpcChannels.plugins.list, async (value) =>
    (await application.plugins.list(value as ListPluginsRequest | undefined)).map(toDesktopPlugin),
  );
  registrar.register(desktopIpcChannels.plugins.listDataResidues, () =>
    application.plugins.listDataResidues(),
  );
  registrar.register(desktopIpcChannels.plugins.setEnabled, async (value) => {
    const request = value as SetPluginEnabledRequest;

    return toDesktopPlugin(
      await application.plugins.setEnabled(request.pluginId, request.enabled, {
        locale: request.locale,
      }),
    );
  });
  registrar.register(desktopIpcChannels.plugins.installPackage, async (value) => {
    const request = value as InstallPluginPackageIpcRequest;
    const installed = await application.plugins.installPackage(request.packagePath, {
      locale: request.locale,
    });

    if (installed.status === "installed-refresh-failed") {
      return {
        status: installed.status,
        installedPluginId: installed.installedPluginId,
        packageName: installed.packageName,
        refreshError: installed.refreshError ?? "Plugin catalog refresh failed.",
      } satisfies DesktopPluginInstallResult;
    }

    return {
      status: installed.status,
      installedPluginId: installed.installedPluginId,
      packageName: installed.packageName,
      ...toDesktopCatalog(requireCatalog(installed.catalog)),
    } satisfies DesktopPluginInstallResult;
  });
  registrar.register(desktopIpcChannels.plugins.uninstall, async (value) => {
    const request = value as UninstallPluginRequest;
    const uninstalled = await application.plugins.uninstall(request.pluginId, {
      locale: request.locale,
    });

    return {
      ...(uninstalled.cleanupError ? { cleanupError: uninstalled.cleanupError } : {}),
      cleanupPending: uninstalled.cleanupPending,
      filesMissing: uninstalled.filesMissing,
      pluginId: uninstalled.pluginId,
      ...toDesktopCatalog(uninstalled.catalog),
      residues: uninstalled.residues,
    } satisfies DesktopPluginUninstallResult;
  });
  registrar.register(desktopIpcChannels.plugins.purgeData, async (value) => {
    const request = value as PurgePluginDataRequest;
    const purged = await application.plugins.purgeData(request.pluginId);

    return {
      pluginId: purged.pluginId,
      kvEntriesRemoved: purged.kvEntriesRemoved,
      stateRemoved: purged.stateRemoved,
      residues: purged.residues,
    };
  });
  registrar.register(desktopIpcChannels.plugins.rescan, async (value) =>
    toDesktopCatalog(await application.plugins.rescan(value as RescanPluginsRequest | undefined)),
  );
}

function toDesktopCatalog(catalog: ApplicationPluginCatalog) {
  const pluginsById = new Map(catalog.plugins.map((plugin) => [plugin.id, plugin]));

  return {
    commands: catalog.commands.map((command) =>
      toDesktopCommand(command, pluginsById.get(command.pluginId)),
    ),
    plugins: catalog.plugins.map(toDesktopPlugin),
  };
}

function requireCatalog(catalog: ApplicationPluginCatalog | undefined): ApplicationPluginCatalog {
  if (!catalog) {
    throw new Error("Installed plugin catalog is unavailable after a successful refresh.");
  }

  return catalog;
}
