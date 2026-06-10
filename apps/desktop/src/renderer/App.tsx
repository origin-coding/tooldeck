import { useEffect, useMemo } from "react";

import { filterCommands, filterPlugins } from "@/renderer/app/selectors";
import { useDesktopStore } from "@/renderer/app/store";
import { CommandWorkbench } from "@/renderer/components/commands/command-workbench";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { AppHeader } from "@/renderer/components/layout/app-header";
import {
  AppSidebar,
  CommandSidebar,
  PluginSidebar,
  SettingsSidebar,
} from "@/renderer/components/layout/sidebar";
import { PluginWorkbench } from "@/renderer/components/plugins/plugin-workbench";
import { SettingsWorkbench } from "@/renderer/components/settings/settings-workbench";

export function App() {
  const state = useDesktopStore();

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
    () => filterCommands(state.commands, state.commandQuery),
    [state.commandQuery, state.commands],
  );
  const filteredPlugins = useMemo(
    () => filterPlugins(state.plugins, state.pluginQuery),
    [state.pluginQuery, state.plugins],
  );
  const selectedPluginCommands = useMemo(
    () => state.commands.filter((command) => command.pluginId === selectedPlugin?.id),
    [selectedPlugin?.id, state.commands],
  );

  useEffect(() => {
    void state.loadData();
  }, [state.loadData]);

  return (
    <main className="app-shell">
      <AppSidebar view={state.view} onChange={state.setView}>
        {state.view === "commands" ? (
          <CommandSidebar
            commands={filteredCommands}
            isLoading={state.isLoadingData}
            query={state.commandQuery}
            selectedCommandId={state.selectedCommandId}
            onQueryChange={state.setCommandQuery}
            onSelect={state.selectCommand}
          />
        ) : state.view === "plugins" ? (
          <PluginSidebar
            plugins={filteredPlugins}
            isLoading={state.isLoadingData}
            query={state.pluginQuery}
            selectedPluginId={selectedPlugin?.id}
            onQueryChange={state.setPluginQuery}
            onSelect={state.selectPlugin}
          />
        ) : (
          <SettingsSidebar />
        )}
      </AppSidebar>

      <section className="app-main">
        <AppHeader
          view={state.view}
          selectedCommand={selectedCommand}
          selectedPlugin={selectedPlugin}
          isLoading={state.isLoadingData}
          isRunning={state.isRunning}
          onRefresh={state.rescanPlugins}
          onRun={state.runSelectedCommand}
        />
        <div className="app-content-scroll">
          <div className="app-content">
            {state.loadError ? <ErrorNotice message={state.loadError} title="Load failed" /> : null}

            {state.view === "commands" ? (
              <CommandWorkbench
                command={selectedCommand}
                plugin={selectedCommandPlugin}
                history={state.history}
                input={state.input}
                isLoading={state.isLoadingData}
                result={state.result}
                runError={state.runError}
                onChangeInput={state.updateInput}
              />
            ) : state.view === "plugins" ? (
              <PluginWorkbench
                plugin={selectedPlugin}
                commands={selectedPluginCommands}
                isLoading={state.isLoadingData}
                onSelectCommand={state.selectCommand}
                onSetEnabled={state.setPluginEnabled}
              />
            ) : (
              <SettingsWorkbench
                commandCount={state.commands.length}
                pluginCount={state.plugins.length}
                historyCount={state.history.length}
                isLoading={state.isLoadingData}
                preferences={state.preferences}
                onRefresh={state.rescanPlugins}
                onSetPreference={state.setPreference}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
