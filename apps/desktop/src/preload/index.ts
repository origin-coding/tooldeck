import { contextBridge, ipcRenderer } from "electron";

import {
  desktopIpcChannels,
  type DesktopApi,
  type GetPreferenceRequest,
  type ListCommandRunsRequest,
  type RunCommandRequest,
  type SetPreferenceRequest,
  type SetPluginEnabledRequest,
} from "@/shared/desktop-api";

const api: DesktopApi = {
  listCommands() {
    return ipcRenderer.invoke(desktopIpcChannels.listCommands);
  },
  listPlugins() {
    return ipcRenderer.invoke(desktopIpcChannels.listPlugins);
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
  rescanPlugins() {
    return ipcRenderer.invoke(desktopIpcChannels.rescanPlugins);
  },
  runCommand(request: RunCommandRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.runCommand, request);
  },
  listCommandRuns(request?: ListCommandRunsRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.listCommandRuns, request);
  },
};

contextBridge.exposeInMainWorld("tooldeck", api);
