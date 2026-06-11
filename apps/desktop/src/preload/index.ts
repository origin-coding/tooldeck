import { contextBridge, ipcRenderer } from "electron";

import {
  desktopIpcChannels,
  type DesktopApi,
  type GetPreferenceRequest,
  type ListCommandsRequest,
  type ListCommandRunsRequest,
  type ListPluginsRequest,
  type RescanPluginsRequest,
  type RunCommandRequest,
  type SetPreferenceRequest,
  type SetPluginEnabledRequest,
} from "@/shared/desktop-api";

const api: DesktopApi = {
  listCommands(request?: ListCommandsRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.listCommands, request);
  },
  listPlugins(request?: ListPluginsRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.listPlugins, request);
  },
  listPreferences() {
    return ipcRenderer.invoke(desktopIpcChannels.listPreferences);
  },
  getPreference(request: GetPreferenceRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.getPreference, request);
  },
  setPreference(request: SetPreferenceRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.setPreference, request);
  },
  setPluginEnabled(request: SetPluginEnabledRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.setPluginEnabled, request);
  },
  rescanPlugins(request?: RescanPluginsRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.rescanPlugins, request);
  },
  runCommand(request: RunCommandRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.runCommand, request);
  },
  listCommandRuns(request?: ListCommandRunsRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.listCommandRuns, request);
  },
};

contextBridge.exposeInMainWorld("tooldeck", api);
