import { ipcMain } from "electron";

import {
  desktopIpcChannels,
  type GetPreferenceRequest,
  type ListCommandsRequest,
  type ListCommandRunsRequest,
  type ListPluginsRequest,
  type RescanPluginsRequest,
  type RunCommandRequest,
  type SetPreferenceRequest,
  type SetPluginEnabledRequest,
} from "@/shared/desktop-api";

import type { TooldeckDesktopService } from "./tooldeck-service";

export function registerTooldeckIpc(service: TooldeckDesktopService): () => void {
  ipcMain.handle(desktopIpcChannels.listCommands, (_event, request?: ListCommandsRequest) =>
    service.listCommands(request),
  );
  ipcMain.handle(desktopIpcChannels.listPlugins, (_event, request?: ListPluginsRequest) =>
    service.listPlugins(request),
  );
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
    ipcMain.removeHandler(desktopIpcChannels.listPreferences);
    ipcMain.removeHandler(desktopIpcChannels.getPreference);
    ipcMain.removeHandler(desktopIpcChannels.setPreference);
    ipcMain.removeHandler(desktopIpcChannels.setPluginEnabled);
    ipcMain.removeHandler(desktopIpcChannels.rescanPlugins);
    ipcMain.removeHandler(desktopIpcChannels.runCommand);
    ipcMain.removeHandler(desktopIpcChannels.listCommandRuns);
  };
}
