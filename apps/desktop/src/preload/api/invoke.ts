import { ipcRenderer } from "electron";

import type { DesktopIpcResult } from "@/shared/ipc";

export async function invokeDesktop<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as DesktopIpcResult<T>;

  if (!result.ok) {
    throw result.error;
  }

  return result.value;
}
