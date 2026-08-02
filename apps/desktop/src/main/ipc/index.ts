import type { TooldeckApplication } from "@tooldeck/application-node";

import { registerCommandsIpc } from "./commands";
import { registerHistoryIpc } from "./history";
import { registerPluginsIpc } from "./plugins";
import { registerPreferencesIpc } from "./preferences";
import { createDesktopIpcRegistrar } from "./register";

export function registerTooldeckIpc(application: TooldeckApplication): () => void {
  const { registrar, dispose } = createDesktopIpcRegistrar();

  try {
    registerCommandsIpc(registrar, application);
    registerPluginsIpc(registrar, application);
    registerPreferencesIpc(registrar, application);
    registerHistoryIpc(registrar, application);
  } catch (error) {
    dispose();
    throw error;
  }

  return dispose;
}
