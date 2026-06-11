import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference } from "@/renderer/i18n";

import { replacePreference } from "../helpers";
import type { DesktopStoreSlice } from "../types";

export interface PreferencesSlice {
  setPreference: import("../types").DesktopStore["setPreference"];
}

export const createPreferencesSlice: DesktopStoreSlice<PreferencesSlice> = (set) => ({
  async setPreference(scope, key, value) {
    try {
      const preference = await window.tooldeck.setPreference({
        scope,
        key,
        value,
      });

      if (preference.key === "locale") {
        applyLocalePreference(preference.value);
      }

      set((current) => ({
        ...current,
        preferences: replacePreference(current.preferences, preference),
        loadError: undefined,
      }));
    } catch (error) {
      set((current) => ({
        ...current,
        loadError: getErrorMessage(error),
      }));
    }
  },
});
