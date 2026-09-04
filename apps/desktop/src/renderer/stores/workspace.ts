import type { CommandResult } from "@tooldeck/protocol";
import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";

import {
  buildCommandInput,
  createInputState,
  type CommandInputState,
  type CommandInputValue,
} from "@/renderer/app/command-input";
import { getErrorMessage, getNavigationMode, getSidebarCollapsed } from "@/renderer/app/selectors";
import type { PluginCleanupWarning, PluginInstallState } from "@/renderer/app/types";
import { readDesktopSession, writeDesktopSession } from "@/renderer/utils/session";
import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPlugin,
  DesktopPluginDataResidue,
  DesktopPreference,
  DesktopPreferenceScope,
} from "@/shared/api";

// Navigation belongs to Nuxt Router. This store owns domain data and command drafts.
export const useWorkspaceStore = defineStore("workspace", () => {
  // API snapshots contain recursive JSON/schema types. Keep them shallow and
  // replace snapshots on refresh instead of deeply unwrapping every JSON node.
  const commands = shallowRef<DesktopCommand[]>([]);
  const plugins = ref<DesktopPlugin[]>([]);
  const preferences = ref<DesktopPreference[]>([]);
  const residues = ref<DesktopPluginDataResidue[]>([]);
  const history = shallowRef<CommandRunRecord[]>([]);
  const recentRunCount = ref(0);
  const drafts = ref<Record<string, CommandInputState>>({});
  const results = shallowRef<Record<string, CommandResult | undefined>>({});
  const runErrors = ref<Record<string, string | undefined>>({});
  const installState = ref<PluginInstallState>({ status: "idle" });
  const cleanupWarning = ref<PluginCleanupWarning>();
  const loading = ref(false);
  const historyLoading = ref(false);
  const initialized = ref(false);
  const runningCommandId = ref<string>();
  const error = ref<string>();
  const historyError = ref<string>();
  let catalogRevision = 0;
  let historyRevision = 0;
  let activeHistoryCommand: string | undefined;

  const locale = computed(() => {
    const value = preference("shared", "locale");
    return value === "en-US" || value === "zh-CN"
      ? value
      : globalThis.navigator?.language.startsWith("zh")
        ? "zh-CN"
        : "en-US";
  });
  const navigationMode = computed(() => getNavigationMode(preferences.value));
  const collapsed = computed(() => getSidebarCollapsed(preferences.value));
  const busy = computed(
    () => loading.value || !!runningCommandId.value || installState.value.status === "installing",
  );
  const blocked = computed(
    () => busy.value || !initialized.value || installState.value.status === "refresh-failed",
  );

  function preference(scope: DesktopPreferenceScope, key: string): unknown {
    return preferences.value.find((item) => item.scope === scope && item.key === key)?.value;
  }

  function applyCatalog(next: { commands: DesktopCommand[]; plugins: DesktopPlugin[] }) {
    commands.value = next.commands;
    plugins.value = next.plugins;
    for (const command of next.commands) {
      drafts.value[command.id] = createInputState(command, drafts.value[command.id] ?? {});
    }
  }

  async function refreshCatalog() {
    const revision = ++catalogRevision;
    const [nextCommands, nextPlugins] = await Promise.all([
      window.tooldeck.commands.list({ locale: locale.value }),
      window.tooldeck.plugins.list({ locale: locale.value }),
    ]);
    if (revision === catalogRevision)
      applyCatalog({ commands: nextCommands, plugins: nextPlugins });
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
      drafts.value = readDesktopSession().drafts;
      const [nextPreferences, nextResidues, recent] = await Promise.all([
        window.tooldeck.preferences.list(),
        window.tooldeck.plugins.listDataResidues(),
        window.tooldeck.history.listRuns({ limit: 25 }),
      ]);
      preferences.value = nextPreferences;
      residues.value = nextResidues;
      recentRunCount.value = recent.length;
      await refreshCatalog();
      initialized.value = true;
    } catch (cause) {
      error.value = getErrorMessage(cause);
    } finally {
      loading.value = false;
    }
  }

  function setInput(commandId: string, key: string, value: CommandInputValue) {
    if (!drafts.value[commandId]) drafts.value[commandId] = {};
    drafts.value[commandId][key] = value;
    writeDesktopSession({ drafts: drafts.value });
  }

  async function loadHistory(commandId?: string) {
    if (activeHistoryCommand !== commandId) history.value = [];
    activeHistoryCommand = commandId;
    const revision = ++historyRevision;
    historyLoading.value = true;
    historyError.value = undefined;
    try {
      const next = await window.tooldeck.history.listRuns({ limit: 50, commandId });
      if (revision === historyRevision) history.value = next;
    } catch (cause) {
      if (revision === historyRevision) historyError.value = getErrorMessage(cause);
    } finally {
      if (revision === historyRevision) historyLoading.value = false;
    }
  }

  async function run(commandId: string) {
    const command = commands.value.find((item) => item.id === commandId);
    if (blocked.value || !command?.pluginEnabled) return;
    runningCommandId.value = commandId;
    results.value = { ...results.value, [commandId]: undefined };
    runErrors.value[commandId] = undefined;
    try {
      const result = await window.tooldeck.commands.run({
        commandId,
        input: buildCommandInput(command, drafts.value[commandId] ?? {}),
        locale: locale.value,
      });
      results.value = { ...results.value, [commandId]: result };
    } catch (cause) {
      runErrors.value[commandId] = getErrorMessage(cause);
    } finally {
      try {
        const [, , recent] = await Promise.all([
          refreshCatalog(),
          loadHistory(activeHistoryCommand),
          window.tooldeck.history.listRuns({ limit: 25 }),
        ]);
        recentRunCount.value = recent.length;
      } catch (cause) {
        error.value = getErrorMessage(cause);
      }
      runningCommandId.value = undefined;
    }
  }

  async function rescan() {
    if (busy.value || !initialized.value) return;
    loading.value = true;
    error.value = undefined;
    try {
      const next = await window.tooldeck.plugins.rescan({ locale: locale.value });
      ++catalogRevision;
      applyCatalog(next);
      residues.value = await window.tooldeck.plugins.listDataResidues();
      if (installState.value.status === "refresh-failed") {
        const { pluginId, packageName } = installState.value;
        installState.value = { status: "success", pluginId, packageName };
      }
      const recent = await window.tooldeck.history.listRuns({ limit: 25 });
      recentRunCount.value = recent.length;
    } catch (cause) {
      error.value = getErrorMessage(cause);
    } finally {
      loading.value = false;
    }
  }

  async function install(file: File): Promise<string | undefined> {
    if (blocked.value) return;
    installState.value = { status: "installing", packageName: file.name };
    error.value = undefined;
    try {
      const next = await window.tooldeck.plugins.installDroppedPackage(file, {
        locale: locale.value,
      });
      if (next.status === "installed-refresh-failed") {
        installState.value = {
          status: "refresh-failed",
          pluginId: next.installedPluginId,
          packageName: next.packageName,
          message: next.refreshError,
        };
        return;
      }
      ++catalogRevision;
      applyCatalog(next);
      // Installation has committed. A later residue query failure must not invite a reinstall.
      installState.value = {
        status: "success",
        pluginId: next.installedPluginId,
        packageName: next.packageName,
      };
      try {
        residues.value = await window.tooldeck.plugins.listDataResidues();
      } catch (cause) {
        error.value = getErrorMessage(cause);
      }
      return next.installedPluginId;
    } catch (cause) {
      installState.value = { status: "error", message: getErrorMessage(cause) };
    }
  }

  async function mutate(operation: () => Promise<void>): Promise<boolean> {
    if (blocked.value) return false;
    loading.value = true;
    error.value = undefined;
    try {
      await operation();
      return true;
    } catch (cause) {
      error.value = getErrorMessage(cause);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function setEnabled(pluginId: string, enabled: boolean) {
    return mutate(async () => {
      await window.tooldeck.plugins.setEnabled({ pluginId, enabled, locale: locale.value });
      await refreshCatalog();
    });
  }

  async function uninstall(pluginId: string) {
    return mutate(async () => {
      cleanupWarning.value = undefined;
      const next = await window.tooldeck.plugins.uninstall({ pluginId, locale: locale.value });
      ++catalogRevision;
      applyCatalog(next);
      residues.value = next.residues;
      const failure = next.cleanupFailures[0];
      if (next.cleanupPending && failure)
        cleanupWarning.value = {
          count: next.cleanupFailures.length,
          step: failure.step,
          message: failure.error.message,
        };
    });
  }

  async function purge(pluginId: string) {
    return mutate(async () => {
      residues.value = (await window.tooldeck.plugins.purgeData({ pluginId })).residues;
    });
  }

  async function setPreference(scope: DesktopPreferenceScope, key: string, value: unknown) {
    return mutate(async () => {
      const updated = await window.tooldeck.preferences.set({ scope, key, value });
      preferences.value = [
        ...preferences.value.filter((item) => item.scope !== scope || item.key !== key),
        updated,
      ];
      if (scope === "shared" && key === "locale") await refreshCatalog();
    });
  }

  return {
    commands,
    plugins,
    preferences,
    residues,
    history,
    recentRunCount,
    drafts,
    results,
    runErrors,
    installState,
    cleanupWarning,
    loading,
    historyLoading,
    initialized,
    runningCommandId,
    error,
    historyError,
    locale,
    navigationMode,
    collapsed,
    busy,
    blocked,
    preference,
    initialize,
    setInput,
    loadHistory,
    run,
    rescan,
    install,
    setEnabled,
    uninstall,
    purge,
    setPreference,
  };
});
