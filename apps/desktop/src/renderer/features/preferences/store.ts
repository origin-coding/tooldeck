import { defineStore } from "pinia";
import { computed, ref } from "vue";

import type { DesktopPreference, DesktopPreferenceScope } from "@/shared/api";

import { getNavigationMode, getSidebarCollapsed } from "./selectors";

export const usePreferencesStore = defineStore("preferences", () => {
  const preferences = ref<DesktopPreference[]>([]);
  const error = ref<string>();
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

  function preference(scope: DesktopPreferenceScope, key: string): unknown {
    return preferences.value.find((item) => item.scope === scope && item.key === key)?.value;
  }

  async function load() {
    preferences.value = await window.tooldeck.preferences.list();
  }

  async function save(scope: DesktopPreferenceScope, key: string, value: unknown) {
    const updated = await window.tooldeck.preferences.set({ scope, key, value });
    preferences.value = [
      ...preferences.value.filter((item) => item.scope !== scope || item.key !== key),
      updated,
    ];
  }

  return { preferences, error, locale, navigationMode, collapsed, preference, load, save };
});
