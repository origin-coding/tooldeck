import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference, getCurrentAppLocale } from "@/renderer/i18n";

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
      const [history, preferences] = await Promise.all([
        window.tooldeck.listCommandRuns({ limit: 25 }),
        window.tooldeck.listPreferences(),
      ]);
      const locale = await applyLocalePreference(
        getPreferenceValue(preferences, "shared", "locale"),
      );
      const [commands, plugins] = await Promise.all([
        window.tooldeck.listCommands({ locale }),
        window.tooldeck.listPlugins({ locale }),
      ]);

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
        window.tooldeck.rescanPlugins({ locale: getCurrentAppLocale() }),
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
        window.tooldeck.listCommands({ locale: getCurrentAppLocale() }),
        window.tooldeck.listPlugins({ locale: getCurrentAppLocale() }),
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
