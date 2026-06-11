import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference } from "@/renderer/i18n";

import { getPreferenceValue, mergeLoadedState } from "../helpers";
import type { DesktopStoreSlice } from "../types";

export interface CatalogSlice {
  loadData(): Promise<void>;
  rescanPlugins(): Promise<void>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
}

export const createCatalogSlice: DesktopStoreSlice<CatalogSlice> = (set) => ({
  async loadData() {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [commands, plugins, history, preferences] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
        window.tooldeck.listCommandRuns({ limit: 25 }),
        window.tooldeck.listPreferences(),
      ]);
      applyLocalePreference(getPreferenceValue(preferences, "shared", "locale"));

      set((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history,
          preferences,
        }),
      );
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
  async rescanPlugins() {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [{ commands, plugins }, history] = await Promise.all([
        window.tooldeck.rescanPlugins(),
        window.tooldeck.listCommandRuns({ limit: 25 }),
      ]);

      set((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history,
          preferences: current.preferences,
        }),
      );
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
  async setPluginEnabled(pluginId, enabled) {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      await window.tooldeck.setPluginEnabled({
        pluginId,
        enabled,
      });
      const [commands, plugins] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
      ]);

      set((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history: current.history,
          preferences: current.preferences,
        }),
      );
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
});
