import { getErrorMessage } from "@/renderer/app/selectors";
import { applyLocalePreference } from "@/renderer/i18n";

import { mergeLoadedState, replacePreference } from "../helpers";
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

      if (preference.scope === "shared" && preference.key === "locale") {
        const locale = await applyLocalePreference(preference.value);

        set((current) => ({
          ...current,
          preferences: replacePreference(current.preferences, preference),
          isLoadingData: true,
          loadError: undefined,
        }));

        const [commands, plugins] = await Promise.all([
          window.tooldeck.listCommands({ locale }),
          window.tooldeck.listPlugins({ locale }),
        ]);

        set((current) =>
          mergeLoadedState({
            current,
            commands,
            plugins,
            history: current.history,
            preferences: replacePreference(current.preferences, preference),
          }),
        );

        return;
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
