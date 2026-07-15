import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { getNavigationMode, getSidebarCollapsed } from "@/renderer/app/selectors";
import { useDesktopStore } from "@/renderer/app/store";
import type { AppView, DesktopNavigationMode } from "@/renderer/app/types";
import { CommandWorkbench } from "@/renderer/components/commands/command-workbench";
import { CommandHistoryWorkbench } from "@/renderer/components/history/command-history-workbench";
import { PluginWorkbench } from "@/renderer/components/plugins/plugin-workbench";
import { SettingsWorkbench } from "@/renderer/components/settings/settings-workbench";

export function WorkbenchSwitch({
  view,
  navigationMode,
}: {
  view: AppView;
  navigationMode: DesktopNavigationMode;
}) {
  if (view === "history") {
    return <CommandHistoryWorkbenchContainer />;
  }

  if (view === "settings") {
    return <SettingsWorkbenchContainer />;
  }

  return <MainWorkbenchSwitch navigationMode={navigationMode} />;
}

function MainWorkbenchSwitch({ navigationMode }: { navigationMode: DesktopNavigationMode }) {
  const selectedCommandId = useDesktopStore((state) => state.selectedCommandId);

  if (selectedCommandId || navigationMode === "entry-first") {
    return <CommandWorkbenchContainer />;
  }

  return <PluginWorkbenchContainer />;
}

function CommandWorkbenchContainer() {
  const {
    commands,
    plugins,
    selectedCommandId,
    input,
    isLoadingData,
    result,
    runError,
    openCommandHistory,
    updateInput,
  } = useDesktopStore(
    useShallow((state) => ({
      commands: state.commands,
      plugins: state.plugins,
      selectedCommandId: state.selectedCommandId,
      input: state.input,
      isLoadingData: state.isLoadingData,
      result: state.result,
      runError: state.runError,
      openCommandHistory: state.openCommandHistory,
      updateInput: state.updateInput,
    })),
  );
  const selectedCommand = useMemo(
    () => commands.find((command) => command.id === selectedCommandId),
    [commands, selectedCommandId],
  );
  const selectedCommandPlugin = useMemo(
    () => plugins.find((plugin) => plugin.id === selectedCommand?.pluginId),
    [selectedCommand?.pluginId, plugins],
  );

  return (
    <CommandWorkbench
      command={selectedCommand}
      plugin={selectedCommandPlugin}
      input={input}
      isLoading={isLoadingData}
      result={result}
      runError={runError}
      onChangeInput={updateInput}
      onOpenHistory={openCommandHistory}
    />
  );
}

function PluginWorkbenchContainer() {
  const {
    commands,
    plugins,
    selectedCommandId,
    selectedPluginId,
    isLoadingData,
    pluginInstall,
    installDroppedPluginPackage,
    rescanPlugins,
    selectCommand,
    setPluginEnabled,
  } = useDesktopStore(
    useShallow((state) => ({
      commands: state.commands,
      plugins: state.plugins,
      selectedCommandId: state.selectedCommandId,
      selectedPluginId: state.selectedPluginId,
      isLoadingData: state.isLoadingData,
      pluginInstall: state.pluginInstall,
      installDroppedPluginPackage: state.installDroppedPluginPackage,
      rescanPlugins: state.rescanPlugins,
      selectCommand: state.selectCommand,
      setPluginEnabled: state.setPluginEnabled,
    })),
  );
  const selectedCommand = useMemo(
    () => commands.find((command) => command.id === selectedCommandId),
    [commands, selectedCommandId],
  );
  const selectedPlugin = useMemo(
    () =>
      plugins.find((plugin) => plugin.id === selectedPluginId) ??
      plugins.find((plugin) => plugin.id === selectedCommand?.pluginId),
    [selectedCommand?.pluginId, plugins, selectedPluginId],
  );
  const selectedPluginCommands = useMemo(
    () => commands.filter((command) => command.pluginId === selectedPlugin?.id),
    [selectedPlugin?.id, commands],
  );

  return (
    <PluginWorkbench
      plugin={selectedPlugin}
      commands={selectedPluginCommands}
      installState={pluginInstall}
      isLoading={isLoadingData}
      onInstall={installDroppedPluginPackage}
      onRescan={rescanPlugins}
      onSelectCommand={selectCommand}
      onSetEnabled={setPluginEnabled}
    />
  );
}

function CommandHistoryWorkbenchContainer() {
  const { historyCommandId, history, isLoadingData } = useDesktopStore(
    useShallow((state) => ({
      historyCommandId: state.historyCommandId,
      history: state.history,
      isLoadingData: state.isLoadingData,
    })),
  );

  return (
    <CommandHistoryWorkbench
      commandId={historyCommandId}
      history={history}
      isLoading={isLoadingData}
    />
  );
}

function SettingsWorkbenchContainer() {
  const {
    commandCount,
    pluginCount,
    historyCount,
    isLoadingData,
    preferences,
    openCommandHistory,
    rescanPlugins,
    setPreference,
  } = useDesktopStore(
    useShallow((state) => ({
      commandCount: state.commands.length,
      pluginCount: state.plugins.length,
      historyCount: state.history.length,
      isLoadingData: state.isLoadingData,
      preferences: state.preferences,
      openCommandHistory: state.openCommandHistory,
      rescanPlugins: state.rescanPlugins,
      setPreference: state.setPreference,
    })),
  );
  const navigationMode = getNavigationMode(preferences);
  const sidebarCollapsed = getSidebarCollapsed(preferences);

  return (
    <SettingsWorkbench
      commandCount={commandCount}
      pluginCount={pluginCount}
      historyCount={historyCount}
      isLoading={isLoadingData}
      navigationMode={navigationMode}
      sidebarCollapsed={sidebarCollapsed}
      preferences={preferences}
      onOpenHistory={openCommandHistory}
      onRefresh={rescanPlugins}
      onSetPreference={setPreference}
    />
  );
}
