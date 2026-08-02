import type { DesktopPreferencesApi } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { invokeDesktop } from "./invoke";

export const preferencesApi: DesktopPreferencesApi = {
  list() {
    return invokeDesktop(desktopIpcChannels.preferences.list);
  },
  get(request) {
    return invokeDesktop(desktopIpcChannels.preferences.get, request);
  },
  set(request) {
    return invokeDesktop(desktopIpcChannels.preferences.set, request);
  },
};
