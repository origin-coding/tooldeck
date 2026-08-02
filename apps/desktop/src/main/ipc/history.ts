import type { TooldeckApplication } from "@tooldeck/application-node";

import type { ListCommandRunsRequest } from "@/shared/api";
import { desktopIpcChannels } from "@/shared/ipc";

import { toDesktopCommandRun } from "../desktop-contract/history";
import type { DesktopIpcRegistrar } from "./register";

export function registerHistoryIpc(
  registrar: DesktopIpcRegistrar,
  application: TooldeckApplication,
): void {
  registrar.register(desktopIpcChannels.history.listRuns, async (value) =>
    (await application.history.listCommandRuns(value as ListCommandRunsRequest | undefined)).map(
      toDesktopCommandRun,
    ),
  );
}
