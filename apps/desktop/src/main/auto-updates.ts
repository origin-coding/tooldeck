import { app } from "electron";
import electronUpdater, { type AppUpdater } from "electron-updater";

const autoUpdatePlatforms = new Set<NodeJS.Platform>(["linux", "win32"]);

export function checkForDesktopUpdates(): void {
  if (!app.isPackaged || !autoUpdatePlatforms.has(process.platform)) {
    return;
  }

  const autoUpdater = getAutoUpdater();

  void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error("Failed to check for Tooldeck updates.", error);
  });
}

function getAutoUpdater(): AppUpdater {
  const { autoUpdater } = electronUpdater;

  return autoUpdater;
}
