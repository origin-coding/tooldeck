import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference, getCurrentAppLocale } from "@/renderer/i18n";

import { getPreferenceValue, mergeLoadedState } from "../helpers";
import type { DesktopStoreSlice } from "../types";

export interface CatalogSlice {
  loadData(): Promise<void>;
  rescanPlugins(): Promise<void>;
  installDroppedPluginPackage(file: File): Promise<void>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
}

export const createCatalogSlice: DesktopStoreSlice<CatalogSlice> = (set, get) => ({
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

      set((current) => {
        const recoveringInstall =
          current.pluginInstall.status === "refresh-failed" ? current.pluginInstall : undefined;
        const loaded = mergeLoadedState({
          current,
          commands,
          plugins,
          history,
          preferences: current.preferences,
        });

        return {
          ...loaded,
          selectedCommandId: recoveringInstall ? undefined : loaded.selectedCommandId,
          selectedPluginId:
            recoveringInstall && plugins.some((plugin) => plugin.id === recoveringInstall.pluginId)
              ? recoveringInstall.pluginId
              : loaded.selectedPluginId,
          pluginInstall: recoveringInstall
            ? {
                status: "success",
                pluginId: recoveringInstall.pluginId,
                packageName: recoveringInstall.packageName,
              }
            : current.pluginInstall,
        };
      });
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
  async installDroppedPluginPackage(file) {
    if (get().pluginInstall.status === "installing") {
      return;
    }

    set((current) => ({
      ...current,
      pluginInstall: {
        status: "installing",
        packageName: file.name,
      },
    }));

    try {
      const result = await window.tooldeck.installDroppedPluginPackage(file, {
        locale: getCurrentAppLocale(),
      });

      if (result.status === "installed-refresh-failed") {
        set((current) => ({
          ...current,
          pluginInstall: {
            status: "refresh-failed",
            pluginId: result.installedPluginId,
            packageName: result.packageName,
            message: result.refreshError,
          },
        }));
        return;
      }

      set((current) => ({
        ...mergeLoadedState({
          current,
          commands: result.commands,
          plugins: result.plugins,
          history: current.history,
          preferences: current.preferences,
        }),
        selectedCommandId: undefined,
        selectedPluginId: result.installedPluginId,
        pluginInstall: {
          status: "success",
          pluginId: result.installedPluginId,
          packageName: result.packageName,
        },
      }));
    } catch (error) {
      set((current) => ({
        ...current,
        pluginInstall: {
          status: "error",
          message: getErrorMessage(error),
        },
      }));
    }
  },
  async setPluginEnabled(pluginId, enabled) {
    if (get().pluginInstall.status === "refresh-failed") {
      return;
    }

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
