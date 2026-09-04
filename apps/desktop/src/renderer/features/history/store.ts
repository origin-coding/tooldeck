import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";

import { getErrorMessage } from "@/renderer/utils/errors";
import type { CommandRunRecord } from "@/shared/api";

export const useHistoryStore = defineStore("history", () => {
  const history = shallowRef<CommandRunRecord[]>([]);
  const recentRunCount = ref(0);
  const loading = ref(false);
  const error = ref<string>();
  const activeCommand = ref<string>();
  let revision = 0;

  async function load(commandId?: string) {
    if (activeCommand.value !== commandId) history.value = [];
    activeCommand.value = commandId;
    const request = ++revision;
    loading.value = true;
    error.value = undefined;
    try {
      const next = await window.tooldeck.history.listRuns({ limit: 50, commandId });
      if (request === revision) history.value = next;
    } catch (cause) {
      if (request === revision) error.value = getErrorMessage(cause);
    } finally {
      if (request === revision) loading.value = false;
    }
  }

  async function refreshRecentCount() {
    const recent = await window.tooldeck.history.listRuns({ limit: 25 });
    recentRunCount.value = recent.length;
  }

  return { history, recentRunCount, loading, error, activeCommand, load, refreshRecentCount };
});
