import { defineStore, storeToRefs } from "pinia";
import { computed } from "vue";

import { useWorkspaceActions } from "@/renderer/app/workspace";
import { useCatalogStore } from "@/renderer/features/catalog/store";
import { useCommandsStore } from "@/renderer/features/commands/store";
import { useHistoryStore } from "@/renderer/features/history/store";
import { usePluginsStore } from "@/renderer/features/plugins/store";
import { usePreferencesStore } from "@/renderer/features/preferences/store";

// Compatibility facade for existing integrations. No state is duplicated here.
// New UI reads feature stores and calls app actions from route/shell boundaries.
export const useWorkspaceStore = defineStore("workspace", () => {
  const actions = useWorkspaceActions();
  const catalog = useCatalogStore();
  const commands = useCommandsStore();
  const history = useHistoryStore();
  const plugins = usePluginsStore();
  const preferences = usePreferencesStore();
  const {
    error: historyError,
    loading: historyLoading,
    history: runs,
    recentRunCount,
  } = storeToRefs(history);
  const { residues, installState, cleanupWarning } = storeToRefs(plugins);
  const { preferences: values, locale, navigationMode, collapsed } = storeToRefs(preferences);
  return {
    ...storeToRefs(catalog),
    ...storeToRefs(commands),
    ...storeToRefs(actions),
    residues,
    installState,
    cleanupWarning,
    preferences: values,
    locale,
    navigationMode,
    collapsed,
    error: computed(() => actions.error ?? plugins.error ?? preferences.error),
    history: runs,
    recentRunCount,
    historyError,
    historyLoading,
    preference: preferences.preference,
    setInput: commands.setInput,
    loadHistory: history.load,
    initialize: actions.initialize,
    run: actions.run,
    rescan: actions.rescan,
    install: actions.install,
    setEnabled: actions.setEnabled,
    uninstall: actions.uninstall,
    purge: actions.purge,
    setPreference: actions.setPreference,
  };
});
