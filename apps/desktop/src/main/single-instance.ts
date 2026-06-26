import type { BrowserWindow } from "electron";

type FocusableWindow = Pick<BrowserWindow, "focus" | "isMinimized" | "restore" | "show">;

export function focusExistingWindow(window: FocusableWindow | undefined): void {
  if (!window) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}
