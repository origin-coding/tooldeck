import { webUtils } from "electron";

import type { DesktopPluginsApi } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { invokeDesktop } from "./invoke";

export const pluginsApi: DesktopPluginsApi = {
  list(request) {
    return invokeDesktop(desktopIpcChannels.plugins.list, request);
  },
  listDataResidues() {
    return invokeDesktop(desktopIpcChannels.plugins.listDataResidues);
  },
  setEnabled(request) {
    return invokeDesktop(desktopIpcChannels.plugins.setEnabled, request);
  },
  installDroppedPackage(file, request = {}) {
    const packagePath = webUtils.getPathForFile(file);

    if (!packagePath) {
      throw new Error("Dropped plugin package is not backed by a local file.");
    }

    return invokeDesktop(desktopIpcChannels.plugins.installPackage, {
      packagePath,
      ...request,
    });
  },
  uninstall(request) {
    return invokeDesktop(desktopIpcChannels.plugins.uninstall, request);
  },
  purgeData(request) {
    return invokeDesktop(desktopIpcChannels.plugins.purgeData, request);
  },
  rescan(request) {
    return invokeDesktop(desktopIpcChannels.plugins.rescan, request);
  },
};
