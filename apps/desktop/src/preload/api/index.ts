import type { DesktopApi } from "@/shared/api";

import { commandsApi } from "./commands";
import { historyApi } from "./history";
import { pluginsApi } from "./plugins";
import { preferencesApi } from "./preferences";

export const desktopApi: DesktopApi = {
  commands: commandsApi,
  plugins: pluginsApi,
  preferences: preferencesApi,
  history: historyApi,
};
