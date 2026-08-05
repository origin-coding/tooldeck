import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference, getCurrentAppLocale } from "@/renderer/i18n";

import { getPreferenceValue, mergeLoadedState } from "../helpers";
import type { DesktopStoreSlice } from "../types";

export interface CatalogSlice {
  loadData(): Promise<void>;
  rescanPlugins(): Promise<void>;
  installDroppedPluginPackage(file: File): Promise<void>;
  uninstallPlugin(pluginId: string): Promise<void>;
  purgePluginData(pluginId: string): Promise<void>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
}

export const createCatalogSlice: DesktopStoreSlice<CatalogSlice> = (set, get) => ({
  async loadData() {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
      pluginCleanupWarning: undefined,
    }));

    try {
      const [history, preferences, pluginDataResidues] = await Promise.all([
        window.tooldeck.history.listRuns({ limit: 25 }),
        window.tooldeck.preferences.list(),
        window.tooldeck.plugins.listDataResidues(),
      ]);
      const locale = await applyLocalePreference(
        getPreferenceValue(preferences, "shared", "locale"),
      );
      const [commands, plugins] = await Promise.all([
        window.tooldeck.commands.list({ locale }),
        window.tooldeck.plugins.list({ locale }),
      ]);

      set((current) => ({
        ...mergeLoadedState({
          current,
          commands,
          plugins,
          history,
          preferences,
        }),
        pluginDataResidues,
      }));
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
      const [{ commands, plugins }, history, pluginDataResidues] = await Promise.all([
        window.tooldeck.plugins.rescan({ locale: getCurrentAppLocale() }),
        window.tooldeck.history.listRuns({ limit: 25 }),
        window.tooldeck.plugins.listDataResidues(),
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
          pluginDataResidues,
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
      const result = await window.tooldeck.plugins.installDroppedPackage(file, {
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

      const pluginDataResidues = await window.tooldeck.plugins.listDataResidues();

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
        pluginDataResidues,
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
  async uninstallPlugin(pluginId) {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
      pluginCleanupWarning: undefined,
    }));

    try {
      const result = await window.tooldeck.plugins.uninstall({
        pluginId,
        locale: getCurrentAppLocale(),
      });

      set((current) => ({
        ...mergeLoadedState({
          current,
          commands: result.commands,
          plugins: result.plugins,
          history: current.history,
          preferences: current.preferences,
        }),
        pluginDataResidues: result.residues,
        pluginCleanupWarning:
          result.cleanupPending && result.cleanupFailures[0]
            ? {
                count: result.cleanupFailures.length,
                step: result.cleanupFailures[0].step,
                message: result.cleanupFailures[0].error.message,
              }
            : undefined,
      }));
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  },
  async purgePluginData(pluginId) {
    set((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const result = await window.tooldeck.plugins.purgeData({ pluginId });

      set((current) => ({
        ...current,
        isLoadingData: false,
        pluginDataResidues: result.residues,
      }));
    } catch (error) {
      set((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
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
      await window.tooldeck.plugins.setEnabled({
        pluginId,
        enabled,
        locale: getCurrentAppLocale(),
      });
      const [commands, plugins] = await Promise.all([
        window.tooldeck.commands.list({ locale: getCurrentAppLocale() }),
        window.tooldeck.plugins.list({ locale: getCurrentAppLocale() }),
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
