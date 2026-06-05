import { ipcMain } from "electron";

import {
  desktopIpcChannels,
  type RunCommandRequest,
  type SetPluginEnabledRequest,
} from "@/shared/desktop-api";
import type { TooldeckDesktopService } from "./tooldeck-service";

export function registerTooldeckIpc(service: TooldeckDesktopService): () => void {
  ipcMain.handle(desktopIpcChannels.listCommands, () => service.listCommands());
  ipcMain.handle(desktopIpcChannels.listPlugins, () => service.listPlugins());
  ipcMain.handle(desktopIpcChannels.setPluginEnabled, (_event, request: SetPluginEnabledRequest) =>
    service.setPluginEnabled(request),
  );
  ipcMain.handle(desktopIpcChannels.rescanPlugins, () => service.rescanPlugins());
  ipcMain.handle(desktopIpcChannels.runCommand, (_event, request: RunCommandRequest) =>
    service.runCommand(request),
  );
  ipcMain.handle(desktopIpcChannels.listCommandRuns, (_event, limit?: number) =>
    service.listCommandRuns(limit),
  );

  return () => {
    ipcMain.removeHandler(desktopIpcChannels.listCommands);
    ipcMain.removeHandler(desktopIpcChannels.listPlugins);
    ipcMain.removeHandler(desktopIpcChannels.setPluginEnabled);
    ipcMain.removeHandler(desktopIpcChannels.rescanPlugins);
    ipcMain.removeHandler(desktopIpcChannels.runCommand);
    ipcMain.removeHandler(desktopIpcChannels.listCommandRuns);
  };
}
