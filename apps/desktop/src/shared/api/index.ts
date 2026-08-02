export * from "./commands";
export * from "./history";
export * from "./plugins";
export * from "./preferences";

import type { DesktopCommandsApi } from "./commands";
import type { DesktopHistoryApi } from "./history";
import type { DesktopPluginsApi } from "./plugins";
import type { DesktopPreferencesApi } from "./preferences";

export interface DesktopApi {
  commands: DesktopCommandsApi;
  plugins: DesktopPluginsApi;
  preferences: DesktopPreferencesApi;
  history: DesktopHistoryApi;
}
