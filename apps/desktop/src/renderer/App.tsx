import { useCallback, useEffect, useMemo, useState } from "react";

import { buildCommandInput, createInputState } from "@/renderer/app/command-input";
import {
  filterCommands,
  filterPlugins,
  getErrorMessage,
  resolveSelectedCommandId,
  resolveSelectedPluginId,
} from "@/renderer/app/selectors";
import { initialState, type AppView } from "@/renderer/app/types";
import { CommandWorkbench } from "@/renderer/components/commands/command-workbench";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { AppHeader } from "@/renderer/components/layout/app-header";
import { AppNav } from "@/renderer/components/layout/app-nav";
import { CommandSidebar, PluginSidebar, SidebarShell } from "@/renderer/components/layout/sidebar";
import { PluginWorkbench } from "@/renderer/components/plugins/plugin-workbench";
import { ScrollArea } from "@/renderer/components/ui/scroll-area";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function App() {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<AppView>("commands");
  const [commandQuery, setCommandQuery] = useState("");
  const [pluginQuery, setPluginQuery] = useState("");

  const selectedCommand = useMemo(
    () => state.commands.find((command) => command.id === state.selectedCommandId),
    [state.commands, state.selectedCommandId],
  );
  const selectedPlugin = useMemo(
    () =>
      state.plugins.find((plugin) => plugin.id === state.selectedPluginId) ??
      state.plugins.find((plugin) => plugin.id === selectedCommand?.pluginId),
    [selectedCommand?.pluginId, state.plugins, state.selectedPluginId],
  );
  const selectedCommandPlugin = useMemo(
    () => state.plugins.find((plugin) => plugin.id === selectedCommand?.pluginId),
    [selectedCommand?.pluginId, state.plugins],
  );
  const filteredCommands = useMemo(
    () => filterCommands(state.commands, commandQuery),
    [commandQuery, state.commands],
  );
  const filteredPlugins = useMemo(
    () => filterPlugins(state.plugins, pluginQuery),
    [pluginQuery, state.plugins],
  );
  const selectedPluginCommands = useMemo(
    () => state.commands.filter((command) => command.pluginId === selectedPlugin?.id),
    [selectedPlugin?.id, state.commands],
  );

  const loadData = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [commands, plugins, history] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history,
        }),
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rescanPlugins = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoadingData: true,
      loadError: undefined,
    }));

    try {
      const [{ commands, plugins }, history] = await Promise.all([
        window.tooldeck.rescanPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history,
        }),
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  const selectCommand = useCallback((command: DesktopCommand) => {
    setView("commands");
    setState((current) => ({
      ...current,
      selectedCommandId: command.id,
      selectedPluginId: command.pluginId,
      input: createInputState(command, current.input),
      result: undefined,
      runError: undefined,
    }));
  }, []);

  const selectPlugin = useCallback((plugin: DesktopPlugin) => {
    setView("plugins");
    setState((current) => ({
      ...current,
      selectedPluginId: plugin.id,
    }));
  }, []);

  const updateInput = useCallback((key: string, value: string) => {
    setState((current) => ({
      ...current,
      input: {
        ...current.input,
        [key]: value,
      },
    }));
  }, []);

  const runSelectedCommand = useCallback(async () => {
    if (
      !selectedCommand ||
      !selectedCommand.pluginEnabled ||
      state.isLoadingData ||
      state.isRunning
    ) {
      return;
    }

    setState((current) => ({
      ...current,
      isRunning: true,
      runError: undefined,
    }));

    try {
      const result = await window.tooldeck.runCommand({
        commandId: selectedCommand.id,
        input: buildCommandInput(selectedCommand, state.input),
      });
      const [commands, plugins, history] = await Promise.all([
        window.tooldeck.listCommands(),
        window.tooldeck.listPlugins(),
        window.tooldeck.listCommandRuns(25),
      ]);

      setState((current) => ({
        ...mergeLoadedState({
          current,
          commands,
          plugins,
          history,
        }),
        result,
        isRunning: false,
      }));
    } catch (error) {
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
        // Keep the existing state if refreshing failed after the run error.
      }

      setState((current) => ({
        ...mergeLoadedState({
          current,
          commands,
          plugins,
          history,
        }),
        isRunning: false,
        runError: getErrorMessage(error),
      }));
    }
  }, [
    selectedCommand,
    state.commands,
    state.history,
    state.input,
    state.isLoadingData,
    state.isRunning,
    state.plugins,
  ]);

  const setPluginEnabled = useCallback(async (pluginId: string, enabled: boolean) => {
    setState((current) => ({
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

      setState((current) =>
        mergeLoadedState({
          current,
          commands,
          plugins,
          history: current.history,
        }),
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoadingData: false,
        loadError: getErrorMessage(error),
      }));
    }
  }, []);

  return (
    <main className="bg-background text-foreground grid h-screen min-h-0 grid-cols-[72px_320px_minmax(0,1fr)] max-lg:grid-cols-[72px_minmax(0,1fr)]">
      <AppNav view={view} onChange={setView} />

      <SidebarShell view={view}>
        {view === "commands" ? (
          <CommandSidebar
            commands={filteredCommands}
            isLoading={state.isLoadingData}
            query={commandQuery}
            selectedCommandId={state.selectedCommandId}
            onQueryChange={setCommandQuery}
            onSelect={selectCommand}
          />
        ) : (
          <PluginSidebar
            plugins={filteredPlugins}
            isLoading={state.isLoadingData}
            query={pluginQuery}
            selectedPluginId={selectedPlugin?.id}
            onQueryChange={setPluginQuery}
            onSelect={selectPlugin}
          />
        )}
      </SidebarShell>

      <section className="flex min-h-0 min-w-0 flex-col">
        <AppHeader
          view={view}
          selectedCommand={selectedCommand}
          selectedPlugin={selectedPlugin}
          isLoading={state.isLoadingData}
          isRunning={state.isRunning}
          onRefresh={rescanPlugins}
          onRun={runSelectedCommand}
        />
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-5 p-5">
            {state.loadError ? <ErrorNotice message={state.loadError} title="Load failed" /> : null}

            {view === "commands" ? (
              <CommandWorkbench
                command={selectedCommand}
                plugin={selectedCommandPlugin}
                history={state.history}
                input={state.input}
                isLoading={state.isLoadingData}
                result={state.result}
                runError={state.runError}
                onChangeInput={updateInput}
              />
            ) : (
              <PluginWorkbench
                plugin={selectedPlugin}
                commands={selectedPluginCommands}
                isLoading={state.isLoadingData}
                onSelectCommand={selectCommand}
                onSetEnabled={setPluginEnabled}
              />
            )}
          </div>
        </ScrollArea>
      </section>
    </main>
  );
}

function mergeLoadedState({
  current,
  commands,
  plugins,
  history,
}: {
  current: typeof initialState;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  history: typeof initialState.history;
}): typeof initialState {
  const selectedCommandId = resolveSelectedCommandId(commands, current.selectedCommandId);
  const selected = commands.find((command) => command.id === selectedCommandId);

  return {
    ...current,
    commands,
    plugins,
    history,
    selectedCommandId,
    selectedPluginId: resolveSelectedPluginId(plugins, current.selectedPluginId, selected),
    input: createInputState(selected, current.input),
    isLoadingData: false,
  };
}
