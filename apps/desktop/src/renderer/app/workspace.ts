import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { useCatalogStore, type CatalogSnapshot } from "@/renderer/features/catalog/store";
import { useCommandsStore } from "@/renderer/features/commands/store";
import { useHistoryStore } from "@/renderer/features/history/store";
import { usePluginsStore } from "@/renderer/features/plugins/store";
import { usePreferencesStore } from "@/renderer/features/preferences/store";
import { getErrorMessage } from "@/renderer/utils/errors";
import type { DesktopPreferenceScope } from "@/shared/api";

// Only this app layer admits cross-feature mutations. Feature stores never import it.
export const useWorkspaceActions = defineStore("workspace-actions", () => {
  const catalog = useCatalogStore();
  const commands = useCommandsStore();
  const history = useHistoryStore();
  const plugins = usePluginsStore();
  const preferences = usePreferencesStore();
  const loading = ref(false);
  const initialized = ref(false);
  const error = ref<string>();
  const busy = computed(
    () =>
      loading.value || !!commands.runningCommandId || plugins.installState.status === "installing",
  );
  const blocked = computed(
    () => busy.value || !initialized.value || plugins.installState.status === "refresh-failed",
  );

  function applyCatalog(next: CatalogSnapshot) {
    catalog.replace(next);
    commands.reconcileDrafts(next.commands);
  }

  async function refreshCatalog() {
    const next = await catalog.refresh(preferences.locale);
    if (next) commands.reconcileDrafts(next.commands);
  }

  async function initialize() {
    if (busy.value || initialized.value) return;
    loading.value = true;
    error.value = undefined;
    try {
      if (!window.tooldeck)
        throw new Error(
          "The Tooldeck desktop bridge is unavailable. Open this page through Electron.",
        );
      commands.restoreDrafts();
      const initialization = await Promise.allSettled([
        preferences.load(),
        plugins.loadResidues(),
        history.refreshRecentCount(),
      ]);
      const failure = initialization.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
      await refreshCatalog();
      initialized.value = true;
    } catch (cause) {
      error.value = getErrorMessage(cause);
    } finally {
      loading.value = false;
    }
  }

  async function run(commandId: string) {
    const command = catalog.commands.find((item) => item.id === commandId);
    if (blocked.value || !command?.pluginEnabled) return;
    try {
      await commands.execute(command, preferences.locale);
      // Keep admission closed until all dependent refreshes have settled.
      const refreshes = await Promise.allSettled([
        refreshCatalog(),
        history.load(history.activeCommand),
        history.refreshRecentCount(),
      ]);
      const failure = refreshes.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") error.value = getErrorMessage(failure.reason);
    } finally {
      commands.finishRun();
    }
  }

  async function rescan() {
    if (busy.value || !initialized.value) return;
    loading.value = true;
    error.value = undefined;
    plugins.error = undefined;
    try {
      applyCatalog(await window.tooldeck.plugins.rescan({ locale: preferences.locale }));
      await plugins.loadResidues();
      plugins.recoverInstall();
      await history.refreshRecentCount();
    } catch (cause) {
      error.value = getErrorMessage(cause);
    } finally {
      loading.value = false;
    }
  }

  async function install(file: File): Promise<string | undefined> {
    if (blocked.value) return;
    // Hold the shared gate beyond the install commit while refreshing residues.
    loading.value = true;
    error.value = undefined;
    try {
      const next = await plugins.install(file, preferences.locale);
      if (!next) return;
      applyCatalog(next);
      try {
        await plugins.loadResidues();
      } catch (cause) {
        plugins.error = getErrorMessage(cause);
      }
      return next.installedPluginId;
    } finally {
      loading.value = false;
    }
  }

  async function mutate(owner: { error: string | undefined }, operation: () => Promise<void>) {
    if (blocked.value) return false;
    loading.value = true;
    owner.error = undefined;
    error.value = undefined;
    try {
      await operation();
      return true;
    } catch (cause) {
      owner.error = getErrorMessage(cause);
      return false;
    } finally {
      loading.value = false;
    }
  }

  function setEnabled(pluginId: string, enabled: boolean) {
    return mutate(plugins, async () => {
      await plugins.setEnabled(pluginId, enabled, preferences.locale);
      await refreshCatalog();
    });
  }

  function uninstall(pluginId: string) {
    return mutate(plugins, async () =>
      applyCatalog(await plugins.uninstall(pluginId, preferences.locale)),
    );
  }

  function purge(pluginId: string) {
    return mutate(plugins, () => plugins.purge(pluginId));
  }

  function setPreference(scope: DesktopPreferenceScope, key: string, value: unknown) {
    return mutate(preferences, async () => {
      await preferences.save(scope, key, value);
      if (scope === "shared" && key === "locale") await refreshCatalog();
    });
  }

  return {
    loading,
    initialized,
    error,
    busy,
    blocked,
    initialize,
    run,
    rescan,
    install,
    setEnabled,
    uninstall,
    purge,
    setPreference,
  };
});
