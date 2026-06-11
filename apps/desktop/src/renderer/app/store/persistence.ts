import { createJSONStorage } from "zustand/middleware";
import type { PersistOptions } from "zustand/middleware";

import { normalizePersistedState } from "./helpers";
import type { DesktopStore } from "./types";

type PersistedDesktopStore = Pick<
  DesktopStore,
  "view" | "selectedCommandId" | "selectedPluginId" | "historyCommandId" | "input"
>;

export const persistenceOptions: PersistOptions<DesktopStore, PersistedDesktopStore> = {
  name: "tooldeck.desktop.ui",
  storage: createJSONStorage(() => localStorage),
  version: 4,
  migrate: (persisted) => normalizePersistedState(persisted) as PersistedDesktopStore,
  partialize: (state) => ({
    view: state.view,
    selectedCommandId: state.selectedCommandId,
    selectedPluginId: state.selectedPluginId,
    historyCommandId: state.historyCommandId,
    input: state.input,
  }),
};
