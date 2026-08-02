import type { DesktopHistoryApi } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { invokeDesktop } from "./invoke";

export const historyApi: DesktopHistoryApi = {
  listRuns(request) {
    return invokeDesktop(desktopIpcChannels.history.listRuns, request);
  },
};
