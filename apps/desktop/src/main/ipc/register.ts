import { toApplicationErrorTransport } from "@tooldeck/application-node";
import { ipcMain } from "electron";

import type { DesktopIpcResult } from "@/shared/ipc";

export type DesktopIpcHandler = (...args: unknown[]) => unknown;

export interface DesktopIpcRegistrar {
  register(channel: string, handler: DesktopIpcHandler): void;
}

export function createDesktopIpcRegistrar(): {
  registrar: DesktopIpcRegistrar;
  dispose(): void;
} {
  const registeredChannels: string[] = [];

  return {
    registrar: {
      register(channel, handler) {
        ipcMain.handle(channel, async (_event, ...args): Promise<DesktopIpcResult<unknown>> => {
          try {
            return {
              ok: true,
              value: await handler(...args),
            };
          } catch (error) {
            return {
              ok: false,
              error: toApplicationErrorTransport(error),
            };
          }
        });
        registeredChannels.push(channel);
      },
    },
    dispose() {
      for (const channel of registeredChannels.splice(0)) {
        ipcMain.removeHandler(channel);
      }
    },
  };
}
