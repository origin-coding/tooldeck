import type { TooldeckApplication } from "@tooldeck/application-node";

import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopCommandRun } from "../desktop-contract/history";
import { decodeListCommandRunsRequest } from "./codecs/requests";
import type { DesktopIpcRegistrar } from "./register";

export function registerHistoryIpc(
  registrar: DesktopIpcRegistrar,
  application: TooldeckApplication,
): void {
  registrar.register(desktopIpcChannels.history.listRuns, async (value) =>
    (await application.history.listCommandRuns(decodeListCommandRunsRequest(value))).map(
      toDesktopCommandRun,
    ),
  );
}
