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
  loadHistory(commandId?: string): Promise<void>;
  openCommandHistory(commandId?: string): Promise<void>;
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
      view: "main",
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
            window.tooldeck.listCommandRuns({ limit: 25 }),
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
      async loadHistory(commandId) {
        set((current) => ({
          ...current,
          isLoadingData: true,
          loadError: undefined,
          historyCommandId: commandId,
        }));

        try {
          const history = await window.tooldeck.listCommandRuns({
            limit: 50,
            commandId,
          });

          set((current) => ({
            ...current,
            history,
            historyCommandId: commandId,
            isLoadingData: false,
          }));
        } catch (error) {
          set((current) => ({
            ...current,
            isLoadingData: false,
            loadError: getErrorMessage(error),
          }));
        }
      },
      async openCommandHistory(commandId) {
        set((current) => ({
          ...current,
          view: "history",
          historyCommandId: commandId,
        }));
        await get().loadHistory(commandId);
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
            window.tooldeck.listCommandRuns({ limit: 25 }),
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
          view: "main",
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
          view: "main",
          selectedPluginId: plugin.id,
          selectedCommandId: undefined,
          result: undefined,
          runError: undefined,
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
            window.tooldeck.listCommandRuns({
              limit: get().view === "history" ? 50 : 25,
              commandId: get().view === "history" ? get().historyCommandId : undefined,
            }),
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
              window.tooldeck.listCommandRuns({
                limit: state.view === "history" ? 50 : 25,
                commandId: state.view === "history" ? state.historyCommandId : undefined,
              }),
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
      version: 2,
      migrate: (persisted) => normalizePersistedState(persisted),
      partialize: (state) => ({
        view: state.view,
        commandQuery: state.commandQuery,
        pluginQuery: state.pluginQuery,
        selectedCommandId: state.selectedCommandId,
        selectedPluginId: state.selectedPluginId,
        historyCommandId: state.historyCommandId,
        input: state.input,
      }),
    },
  ),
);

function normalizePersistedState(persisted: unknown): unknown {
  if (!persisted || typeof persisted !== "object") {
    return persisted;
  }

  const state = persisted as { view?: string };

  if (state.view === "commands" || state.view === "plugins" || state.view === "workbench") {
    return {
      ...state,
      view: "main",
    };
  }

  return persisted;
}

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
