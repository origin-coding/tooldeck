import type { DesktopCommandsApi } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { invokeDesktop } from "./invoke";

export const commandsApi: DesktopCommandsApi = {
  list(request) {
    return invokeDesktop(desktopIpcChannels.commands.list, request);
  },
  run(request) {
    return invokeDesktop(desktopIpcChannels.commands.run, request);
  },
};
