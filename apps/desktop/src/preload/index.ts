import { contextBridge, ipcRenderer } from "electron";

import {
  desktopIpcChannels,
  type DesktopApi,
  type RunCommandRequest,
  type SetPluginEnabledRequest,
} from "@/shared/desktop-api";

const api: DesktopApi = {
  listCommands() {
    return ipcRenderer.invoke(desktopIpcChannels.listCommands);
  },
  listPlugins() {
    return ipcRenderer.invoke(desktopIpcChannels.listPlugins);
  },
  setPluginEnabled(request: SetPluginEnabledRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.setPluginEnabled, request);
  },
  rescanPlugins() {
    return ipcRenderer.invoke(desktopIpcChannels.rescanPlugins);
  },
  runCommand(request: RunCommandRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.runCommand, request);
  },
  listCommandRuns(limit?: number) {
    return ipcRenderer.invoke(desktopIpcChannels.listCommandRuns, limit);
  },
};

contextBridge.exposeInMainWorld("tooldeck", api);
