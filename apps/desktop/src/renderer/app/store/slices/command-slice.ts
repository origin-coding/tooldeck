import { buildCommandInput } from "@/renderer/app/command-input";
import { getErrorMessage } from "@/renderer/app/selectors";
import { getCurrentAppLocale } from "@/renderer/i18n";

import { mergeLoadedState } from "../helpers";
import type { DesktopStoreSlice } from "../types";

export interface CommandSlice {
  updateInput(key: string, value: string): void;
  runSelectedCommand(): Promise<void>;
}

export const createCommandSlice: DesktopStoreSlice<CommandSlice> = (set, get) => ({
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
      const locale = getCurrentAppLocale();
      const [commands, plugins, history] = await Promise.all([
        window.tooldeck.listCommands({ locale }),
        window.tooldeck.listPlugins({ locale }),
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
        const locale = getCurrentAppLocale();
        [commands, plugins, history] = await Promise.all([
          window.tooldeck.listCommands({ locale }),
          window.tooldeck.listPlugins({ locale }),
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
});
