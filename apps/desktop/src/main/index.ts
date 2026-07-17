import path from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

import { checkForDesktopUpdates } from "./auto-updates";
import { DesktopLifecycle } from "./desktop-lifecycle";
import { registerTooldeckIpc } from "./ipc";
import { resolveDesktopPluginDirs } from "./plugin-dirs";
import { focusExistingWindow } from "./single-instance";
import { TooldeckDesktopService } from "./tooldeck-service";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

let isShuttingDown = false;

const desktopLifecycle = new DesktopLifecycle({
  createBackend: () => new TooldeckDesktopService(createServiceOptions()),
  registerIpc: registerTooldeckIpc,
  createWindow: () =>
    new BrowserWindow({
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
    }),
  async loadWindow(window) {
    const rendererUrl = process.env.TOOLDECK_RENDERER_URL;

    if (rendererUrl) {
      await window.loadURL(rendererUrl);
    } else {
      await window.loadFile(path.join(currentDirectory, "../renderer/index.html"));
    }
  },
});

function createServiceOptions(): ConstructorParameters<typeof TooldeckDesktopService>[0] {
  const pluginsRoot = process.env.TOOLDECK_PLUGINS_ROOT;
  const pluginDirs = resolveDesktopPluginDirs();

  if (pluginsRoot) {
    return {
      pluginDirs,
      pluginsRoot,
    };
  }

  if (!app.isPackaged) {
    return {
      pluginDirs,
    };
  }

  return {
    pluginDirs,
    pluginsRoot: path.join(process.resourcesPath, "plugins"),
    storagePath: path.join(app.getPath("userData"), "tooldeck.sqlite"),
  };
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusExistingWindow(desktopLifecycle.getWindow());
  });

  app.whenReady().then(() => {
    void desktopLifecycle
      .openWindow()
      .then(() => {
        checkForDesktopUpdates();
      })
      .catch((error) => {
        console.error("Failed to start Tooldeck desktop.", error);
        app.quit();
      });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void desktopLifecycle.openWindow().catch((error) => {
          console.error("Failed to create Tooldeck window.", error);
        });
      }
    });
  });
}

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

  void shutdown()
    .catch((error) => {
      console.error("Failed to shut down Tooldeck desktop cleanly.", error);
    })
    .finally(() => {
      app.quit();
    });
});

async function shutdown(): Promise<void> {
  await desktopLifecycle.shutdown();
}
