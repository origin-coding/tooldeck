import type { PreferenceScope } from "@tooldeck/shared";

import { createInputState } from "@/renderer/app/command-input";
import { resolveSelectedCommandId, resolveSelectedPluginId } from "@/renderer/app/selectors";
import type { AppState } from "@/renderer/app/types";
import type { DesktopCommand, DesktopPlugin, DesktopPreference } from "@/shared/desktop-api";

export function mergeLoadedState({
  current,
  commands,
  plugins,
  history,
  preferences,
}: {
  current: AppState;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  history: AppState["history"];
  preferences: DesktopPreference[];
}): AppState {
  const selectedCommandId = resolveSelectedCommandId(commands, current.selectedCommandId);
  const selected = commands.find((command) => command.id === selectedCommandId);

  return {
    ...current,
    commands,
    plugins,
    history,
    preferences,
    selectedCommandId,
    selectedPluginId: resolveSelectedPluginId(plugins, current.selectedPluginId, selected),
    input: createInputState(selected, current.input),
    isLoadingData: false,
  };
}

export function normalizePersistedState(persisted: unknown): unknown {
  if (!persisted || typeof persisted !== "object") {
    return persisted;
  }

  const state = {
    ...(persisted as {
      commandQuery?: string;
      pluginQuery?: string;
      view?: string;
    }),
  };
  delete state.commandQuery;
  delete state.pluginQuery;

  if (state.view === "commands" || state.view === "plugins" || state.view === "workbench") {
    return {
      ...state,
      view: "main",
    };
  }

  return state;
}

export function getPreferenceValue(
  preferences: DesktopPreference[],
  scope: PreferenceScope,
  key: string,
): unknown {
  return preferences.find((preference) => preference.scope === scope && preference.key === key)
    ?.value;
}

export function replacePreference(
  preferences: DesktopPreference[],
  updated: DesktopPreference,
): DesktopPreference[] {
  const exists = preferences.some(
    (preference) => preference.scope === updated.scope && preference.key === updated.key,
  );

  if (!exists) {
    return [...preferences, updated];
  }

  return preferences.map((preference) =>
    preference.scope === updated.scope && preference.key === updated.key ? updated : preference,
  );
}
