import type { PreferenceScope } from "@tooldeck/shared";

import { createInputState } from "@/renderer/app/command-input";
import { getNavigationMode } from "@/renderer/app/selectors";
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
  const selection = resolveLoadedSelection({
    commands,
    plugins,
    preferences,
    selectedCommandId: current.selectedCommandId,
    selectedPluginId: current.selectedPluginId,
  });
  const selected = commands.find((command) => command.id === selection.selectedCommandId);

  return {
    ...current,
    commands,
    plugins,
    history,
    preferences,
    selectedCommandId: selection.selectedCommandId,
    selectedPluginId: selection.selectedPluginId,
    input: createInputState(selected, current.input),
    isLoadingData: false,
  };
}

export function resolveLoadedSelection({
  commands,
  plugins,
  preferences,
  selectedCommandId,
  selectedPluginId,
}: {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  preferences: DesktopPreference[];
  selectedCommandId?: string;
  selectedPluginId?: string;
}): {
  selectedCommandId?: string;
  selectedPluginId?: string;
} {
  const navigationMode = getNavigationMode(preferences);
  const selectedCommand = selectedCommandId
    ? commands.find((command) => command.id === selectedCommandId)
    : undefined;
  const selectedPlugin = selectedPluginId
    ? plugins.find((plugin) => plugin.id === selectedPluginId)
    : undefined;

  if (navigationMode === "provider-first") {
    if (selectedCommand) {
      if (selectedPlugin && selectedPlugin.id !== selectedCommand.pluginId) {
        return {
          selectedPluginId: selectedPlugin.id,
        };
      }

      return {
        selectedCommandId: selectedCommand.id,
        selectedPluginId:
          selectedPlugin?.id ??
          plugins.find((plugin) => plugin.id === selectedCommand.pluginId)?.id ??
          plugins[0]?.id,
      };
    }

    return {
      selectedPluginId: selectedPlugin?.id ?? plugins[0]?.id,
    };
  }

  const command = selectedCommand ?? commands[0];

  return {
    selectedCommandId: command?.id,
    selectedPluginId:
      selectedPlugin?.id ??
      (command ? plugins.find((plugin) => plugin.id === command.pluginId)?.id : undefined) ??
      plugins[0]?.id,
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
