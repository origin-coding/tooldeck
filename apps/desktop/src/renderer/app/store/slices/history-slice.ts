import { getErrorMessage } from "@/renderer/app/selectors";

import type { DesktopStoreSlice } from "../types";

export interface HistorySlice {
  loadHistory(commandId?: string): Promise<void>;
  openCommandHistory(commandId?: string): Promise<void>;
}

export const createHistorySlice: DesktopStoreSlice<HistorySlice> = (set, get) => ({
  async loadHistory(commandId) {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
      historyCommandId: commandId,
    }));

    try {
      const history = await window.tooldeck.listCommandRuns({
        limit: 50,
        commandId,
      });

      set((current) => ({
        ...current,
        history,
        historyCommandId: commandId,
        isLoadingData: false,
      }));
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
  async openCommandHistory(commandId) {
    set((current) => ({
      ...current,
      view: "history",
      historyCommandId: commandId,
    }));
    await get().loadHistory(commandId);
  },
});
