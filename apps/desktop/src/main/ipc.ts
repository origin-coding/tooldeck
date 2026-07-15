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
  ipcMain.handle(desktopIpcChannels.listCommands, (_event, request?: ListCommandsRequest) =>
    service.listCommands(request),
  );
  ipcMain.handle(desktopIpcChannels.listPlugins, (_event, request?: ListPluginsRequest) =>
    service.listPlugins(request),
  );
  ipcMain.handle(desktopIpcChannels.listPluginDataResidues, () => service.listPluginDataResidues());
  ipcMain.handle(desktopIpcChannels.listPreferences, () => service.listPreferences());
  ipcMain.handle(desktopIpcChannels.getPreference, (_event, request: GetPreferenceRequest) =>
    service.getPreference(request),
  );
  ipcMain.handle(desktopIpcChannels.setPreference, (_event, request: SetPreferenceRequest) =>
    service.setPreference(request),
  );
  ipcMain.handle(desktopIpcChannels.setPluginEnabled, (_event, request: SetPluginEnabledRequest) =>
    service.setPluginEnabled(request),
  );
  ipcMain.handle(
    desktopIpcChannels.installPluginPackage,
    (_event, request: InstallPluginPackageIpcRequest) => service.installPluginPackage(request),
  );
  ipcMain.handle(desktopIpcChannels.uninstallPlugin, (_event, request: UninstallPluginRequest) =>
    service.uninstallPlugin(request),
  );
  ipcMain.handle(desktopIpcChannels.purgePluginData, (_event, request: PurgePluginDataRequest) =>
    service.purgePluginData(request),
  );
  ipcMain.handle(desktopIpcChannels.rescanPlugins, (_event, request?: RescanPluginsRequest) =>
    service.rescanPlugins(request),
  );
  ipcMain.handle(desktopIpcChannels.runCommand, (_event, request: RunCommandRequest) =>
    service.runCommand(request),
  );
  ipcMain.handle(desktopIpcChannels.listCommandRuns, (_event, request?: ListCommandRunsRequest) =>
    service.listCommandRuns(request),
  );

  return () => {
    ipcMain.removeHandler(desktopIpcChannels.listCommands);
    ipcMain.removeHandler(desktopIpcChannels.listPlugins);
    ipcMain.removeHandler(desktopIpcChannels.listPluginDataResidues);
    ipcMain.removeHandler(desktopIpcChannels.listPreferences);
    ipcMain.removeHandler(desktopIpcChannels.getPreference);
    ipcMain.removeHandler(desktopIpcChannels.setPreference);
    ipcMain.removeHandler(desktopIpcChannels.setPluginEnabled);
    ipcMain.removeHandler(desktopIpcChannels.installPluginPackage);
    ipcMain.removeHandler(desktopIpcChannels.uninstallPlugin);
    ipcMain.removeHandler(desktopIpcChannels.purgePluginData);
    ipcMain.removeHandler(desktopIpcChannels.rescanPlugins);
    ipcMain.removeHandler(desktopIpcChannels.runCommand);
    ipcMain.removeHandler(desktopIpcChannels.listCommandRuns);
  };
}
