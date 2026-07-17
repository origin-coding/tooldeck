import { ipcMain } from "electron";

import {
  desktopIpcChannels,
  type GetPreferenceRequest,
  type InstallPluginPackageIpcRequest,
  type ListCommandsRequest,
  type ListCommandRunsRequest,
  type ListPluginsRequest,
  type PurgePluginDataRequest,
  type RescanPluginsRequest,
  type RunCommandRequest,
  type SetPreferenceRequest,
  type SetPluginEnabledRequest,
  type UninstallPluginRequest,
} from "@/shared/desktop-api";

import type { TooldeckDesktopService } from "./tooldeck-service";

export function registerTooldeckIpc(service: TooldeckDesktopService): () => void {
  const registeredChannels: string[] = [];
  const register = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.handle(channel, handler);
    registeredChannels.push(channel);
  };
  const dispose = () => {
    for (const channel of registeredChannels.splice(0)) {
      ipcMain.removeHandler(channel);
    }
  };

  try {
    register(desktopIpcChannels.listCommands, (_event, request?: ListCommandsRequest) =>
      service.listCommands(request),
    );
    register(desktopIpcChannels.listPlugins, (_event, request?: ListPluginsRequest) =>
      service.listPlugins(request),
    );
    register(desktopIpcChannels.listPluginDataResidues, () => service.listPluginDataResidues());
    register(desktopIpcChannels.listPreferences, () => service.listPreferences());
    register(desktopIpcChannels.getPreference, (_event, request: GetPreferenceRequest) =>
      service.getPreference(request),
    );
    register(desktopIpcChannels.setPreference, (_event, request: SetPreferenceRequest) =>
      service.setPreference(request),
    );
    register(desktopIpcChannels.setPluginEnabled, (_event, request: SetPluginEnabledRequest) =>
      service.setPluginEnabled(request),
    );
    register(
      desktopIpcChannels.installPluginPackage,
      (_event, request: InstallPluginPackageIpcRequest) => service.installPluginPackage(request),
    );
    register(desktopIpcChannels.uninstallPlugin, (_event, request: UninstallPluginRequest) =>
      service.uninstallPlugin(request),
    );
    register(desktopIpcChannels.purgePluginData, (_event, request: PurgePluginDataRequest) =>
      service.purgePluginData(request),
    );
    register(desktopIpcChannels.rescanPlugins, (_event, request?: RescanPluginsRequest) =>
      service.rescanPlugins(request),
    );
    register(desktopIpcChannels.runCommand, (_event, request: RunCommandRequest) =>
      service.runCommand(request),
    );
    register(desktopIpcChannels.listCommandRuns, (_event, request?: ListCommandRunsRequest) =>
      service.listCommandRuns(request),
    );
  } catch (error) {
    dispose();
    throw error;
  }

  return dispose;
}
