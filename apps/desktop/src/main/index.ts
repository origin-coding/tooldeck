import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { registerTooldeckIpc } from "./ipc";
import { TooldeckDesktopService } from "./tooldeck-service";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | undefined;
let disposeIpc: (() => void) | undefined;
let service: TooldeckDesktopService | undefined;
let isShuttingDown = false;

async function createWindow(): Promise<void> {
  service = new TooldeckDesktopService();
  await service.start();
  disposeIpc = registerTooldeckIpc(service);

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    title: "Tooldeck",
    webPreferences: {
      preload: path.join(currentDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const rendererUrl = process.env.TOOLDECK_RENDERER_URL;

  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
  } else {
    await mainWindow.loadFile(path.join(currentDirectory, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  void createWindow().catch((error) => {
    console.error("Failed to start Tooldeck desktop.", error);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow().catch((error) => {
        console.error("Failed to create Tooldeck window.", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (isShuttingDown) {
    return;
  }

  event.preventDefault();
  isShuttingDown = true;

  void shutdown().finally(() => {
    app.quit();
  });
});

async function shutdown(): Promise<void> {
  disposeIpc?.();
  disposeIpc = undefined;

  const activeService = service;
  service = undefined;

  await activeService?.dispose();
}
