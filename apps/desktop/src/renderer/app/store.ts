import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { buildCommandInput, createInputState } from "@/renderer/app/command-input";
import {
  getErrorMessage,
  resolveSelectedCommandId,
  resolveSelectedPluginId,
} from "@/renderer/app/selectors";
import { initialState, type AppState, type AppView } from "@/renderer/app/types";
import { applyLocalePreference } from "@/renderer/i18n";
import type { DesktopCommand, DesktopPlugin, DesktopPreference } from "@/shared/desktop-api";

interface DesktopStore extends AppState {
  view: AppView;
  commandQuery: string;
  pluginQuery: string;
  setView(view: AppView): void;
  setCommandQuery(query: string): void;
  setPluginQuery(query: string): void;
  loadData(): Promise<void>;
  rescanPlugins(): Promise<void>;
  selectCommand(command: DesktopCommand): void;
  selectPlugin(plugin: DesktopPlugin): void;
  updateInput(key: string, value: string): void;
  runSelectedCommand(): Promise<void>;
  setPreference(key: string, value: unknown): Promise<void>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
}

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      view: "plugins",
      commandQuery: "",
      pluginQuery: "",
      setView(view) {
        set({ view });
      },
      setCommandQuery(commandQuery) {
        set({ commandQuery });
      },
      setPluginQuery(pluginQuery) {
        set({ pluginQuery });
      },
      async loadData() {
        set((current) => ({
          ...current,
          isLoadingData: true,
          loadError: undefined,
        }));

        try {
          const [commands, plugins, history, preferences] = await Promise.all([
            window.tooldeck.listCommands(),
            window.tooldeck.listPlugins(),
            window.tooldeck.listCommandRuns(25),
            window.tooldeck.listPreferences(),
          ]);
          applyLocalePreference(getPreferenceValue(preferences, "locale"));

          set((current) =>
            mergeLoadedState({
              current,
              commands,
              plugins,
              history,
              preferences,
            }),
          );
        } catch (error) {
          set((current) => ({
            ...current,
            isLoadingData: false,
            loadError: getErrorMessage(error),
          }));
        }
      },
      async rescanPlugins() {
        set((current) => ({
          ...current,
          isLoadingData: true,
          loadError: undefined,
        }));

        try {
          const [{ commands, plugins }, history] = await Promise.all([
            window.tooldeck.rescanPlugins(),
            window.tooldeck.listCommandRuns(25),
          ]);

          set((current) =>
            mergeLoadedState({
              current,
              commands,
              plugins,
              history,
              preferences: current.preferences,
            }),
          );
        } catch (error) {
          set((current) => ({
            ...current,
            isLoadingData: false,
            loadError: getErrorMessage(error),
          }));
        }
      },
      selectCommand(command) {
        set((current) => ({
          ...current,
          view: "commands",
          selectedCommandId: command.id,
          selectedPluginId: command.pluginId,
          input: createInputState(command, current.input),
          result: undefined,
          runError: undefined,
        }));
      },
      selectPlugin(plugin) {
        set((current) => ({
          ...current,
          view: "plugins",
          selectedPluginId: plugin.id,
        }));
      },
      updateInput(key, value) {
        set((current) => ({
          ...current,
          input: {
            ...current.input,
            [key]: value,
          },
        }));
      },
      async runSelectedCommand() {
        const current = get();
        const selectedCommand = current.commands.find(
          (command) => command.id === current.selectedCommandId,
        );

        if (
          !selectedCommand ||
          !selectedCommand.pluginEnabled ||
          current.isLoadingData ||
          current.isRunning
        ) {
          return;
        }

        set((state) => ({
          ...state,
          isRunning: true,
          runError: undefined,
        }));

        try {
          const input = buildCommandInput(selectedCommand, current.input);
          const result = await window.tooldeck.runCommand({
            commandId: selectedCommand.id,
            input,
          });
          const [commands, plugins, history] = await Promise.all([
            window.tooldeck.listCommands(),
            window.tooldeck.listPlugins(),
            window.tooldeck.listCommandRuns(25),
          ]);

          set((state) => ({
            ...mergeLoadedState({
              current: state,
              commands,
              plugins,
              history,
              preferences: state.preferences,
            }),
            result,
            isRunning: false,
          }));
        } catch (error) {
          const state = get();
          let history = state.history;
          let commands = state.commands;
          let plugins = state.plugins;

          try {
            [commands, plugins, history] = await Promise.all([
              window.tooldeck.listCommands(),
              window.tooldeck.listPlugins(),
              window.tooldeck.listCommandRuns(25),
            ]);
          } catch {
            // Keep existing state if refreshing failed after the run error.
          }

          set((latest) => ({
            ...mergeLoadedState({
              current: latest,
              commands,
              plugins,
              history,
              preferences: latest.preferences,
            }),
            isRunning: false,
            runError: getErrorMessage(error),
          }));
        }
      },
      async setPreference(key, value) {
        try {
          const preference = await window.tooldeck.setPreference({
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
      async setPluginEnabled(pluginId, enabled) {
        set((current) => ({
          ...current,
          isLoadingData: true,
          loadError: undefined,
        }));

        try {
          await window.tooldeck.setPluginEnabled({
            pluginId,
            enabled,
          });
          const [commands, plugins] = await Promise.all([
            window.tooldeck.listCommands(),
            window.tooldeck.listPlugins(),
          ]);

          set((current) =>
            mergeLoadedState({
              current,
              commands,
              plugins,
              history: current.history,
              preferences: current.preferences,
            }),
          );
        } catch (error) {
          set((current) => ({
            ...current,
            isLoadingData: false,
            loadError: getErrorMessage(error),
          }));
        }
      },
    }),
    {
      name: "tooldeck.desktop.ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        view: state.view,
        commandQuery: state.commandQuery,
        pluginQuery: state.pluginQuery,
        selectedCommandId: state.selectedCommandId,
        selectedPluginId: state.selectedPluginId,
        input: state.input,
      }),
    },
  ),
);

function mergeLoadedState({
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

function getPreferenceValue(preferences: DesktopPreference[], key: string): unknown {
  return preferences.find((preference) => preference.key === key)?.value;
}

function replacePreference(
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
