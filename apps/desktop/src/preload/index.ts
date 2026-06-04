import { contextBridge, ipcRenderer } from "electron";

import {
  desktopIpcChannels,
  type DesktopApi,
  type RunCommandRequest,
} from "../shared/desktop-api";

const api: DesktopApi = {
  listCommands() {
    return ipcRenderer.invoke(desktopIpcChannels.listCommands);
  },
  runCommand(request: RunCommandRequest) {
    return ipcRenderer.invoke(desktopIpcChannels.runCommand, request);
  },
  listCommandRuns(limit?: number) {
    return ipcRenderer.invoke(desktopIpcChannels.listCommandRuns, limit);
  },
};

contextBridge.exposeInMainWorld("tooldeck", api);
