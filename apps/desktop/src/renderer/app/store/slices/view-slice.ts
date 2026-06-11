import { createInputState } from "@/renderer/app/command-input";
import type { AppView } from "@/renderer/app/types";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

import type { DesktopStoreSlice } from "../types";

export interface ViewSlice {
  selectCommand(command: DesktopCommand): void;
  selectPlugin(plugin: DesktopPlugin): void;
  setView(view: AppView): void;
}

export const createViewSlice: DesktopStoreSlice<ViewSlice> = (set) => ({
  setView(view) {
    set({ view });
  },
  selectCommand(command) {
    set((current) => ({
      ...current,
      view: "main",
      selectedCommandId: command.id,
      selectedPluginId: command.pluginId,
      input: createInputState(command, current.input),
      result: undefined,
      runError: undefined,
    }));
  },
  selectPlugin(plugin) {
    set((current) => ({
      ...current,
      view: "main",
      selectedPluginId: plugin.id,
      selectedCommandId: undefined,
      result: undefined,
      runError: undefined,
    }));
  },
});
