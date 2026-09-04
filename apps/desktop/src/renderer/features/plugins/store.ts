import { defineStore } from "pinia";
import { ref } from "vue";

import { getErrorMessage } from "@/renderer/utils/errors";
import type { DesktopPluginDataResidue } from "@/shared/api";

import type { PluginCleanupWarning, PluginInstallState } from "./types";

export const usePluginsStore = defineStore("plugins", () => {
  const residues = ref<DesktopPluginDataResidue[]>([]);
  const installState = ref<PluginInstallState>({ status: "idle" });
  const cleanupWarning = ref<PluginCleanupWarning>();
  const error = ref<string>();

  async function loadResidues() {
    residues.value = await window.tooldeck.plugins.listDataResidues();
  }

  async function install(file: File, locale: string) {
    installState.value = { status: "installing", packageName: file.name };
    error.value = undefined;
    try {
      const next = await window.tooldeck.plugins.installDroppedPackage(file, { locale });
      if (next.status === "installed-refresh-failed") {
        installState.value = {
          status: "refresh-failed",
          pluginId: next.installedPluginId,
          packageName: next.packageName,
          message: next.refreshError,
        };
        return;
      }
      // Commit is final even if a subsequent catalog/residue refresh fails.
      installState.value = {
        status: "success",
        pluginId: next.installedPluginId,
        packageName: next.packageName,
      };
      return next;
    } catch (cause) {
      installState.value = { status: "error", message: getErrorMessage(cause) };
    }
  }

  function recoverInstall() {
    if (installState.value.status === "refresh-failed") {
      const { pluginId, packageName } = installState.value;
      installState.value = { status: "success", pluginId, packageName };
    }
  }

  async function uninstall(pluginId: string, locale: string) {
    cleanupWarning.value = undefined;
    const next = await window.tooldeck.plugins.uninstall({ pluginId, locale });
    residues.value = next.residues;
    const failure = next.cleanupFailures[0];
    if (next.cleanupPending && failure) {
      cleanupWarning.value = {
        count: next.cleanupFailures.length,
        step: failure.step,
        message: failure.error.message,
      };
    }
    return next;
  }

  async function setEnabled(pluginId: string, enabled: boolean, locale: string) {
    await window.tooldeck.plugins.setEnabled({ pluginId, enabled, locale });
  }

  async function purge(pluginId: string) {
    residues.value = (await window.tooldeck.plugins.purgeData({ pluginId })).residues;
  }

  return {
    residues,
    installState,
    cleanupWarning,
    error,
    loadResidues,
    install,
    recoverInstall,
    uninstall,
    setEnabled,
    purge,
  };
});
