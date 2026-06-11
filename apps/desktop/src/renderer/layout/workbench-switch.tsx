import type { CommandResult } from "@tooldeck/protocol";

import type { AppView, DesktopNavigationMode } from "@/renderer/app/types";
import { CommandWorkbench } from "@/renderer/components/commands/command-workbench";
import { CommandHistoryWorkbench } from "@/renderer/components/history/command-history-workbench";
import { PluginWorkbench } from "@/renderer/components/plugins/plugin-workbench";
import { SettingsWorkbench } from "@/renderer/components/settings/settings-workbench";
import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPlugin,
  DesktopPreference,
} from "@/shared/desktop-api";

export function WorkbenchSwitch({
  view,
  navigationMode,
  selectedCommand,
  selectedCommandPlugin,
  selectedPlugin,
  selectedPluginCommands,
  input,
  isLoading,
  result,
  runError,
  historyCommandId,
  history,
  commands,
  plugins,
  preferences,
  sidebarCollapsed,
  onChangeInput,
  onOpenHistory,
  onSelectCommand,
  onSetPluginEnabled,
  onRefresh,
  onSetPreference,
}: {
  view: AppView;
  navigationMode: DesktopNavigationMode;
  selectedCommand?: DesktopCommand;
  selectedCommandPlugin?: DesktopPlugin;
  selectedPlugin?: DesktopPlugin;
  selectedPluginCommands: DesktopCommand[];
  input: Record<string, string>;
  isLoading: boolean;
  result?: CommandResult;
  runError?: string;
  historyCommandId?: string;
  history: CommandRunRecord[];
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  preferences: DesktopPreference[];
  sidebarCollapsed: boolean;
  onChangeInput(key: string, value: string): void;
  onOpenHistory(commandId?: string): Promise<void>;
  onSelectCommand(command: DesktopCommand): void;
  onSetPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
  onRefresh(): Promise<void>;
  onSetPreference(scope: DesktopPreference["scope"], key: string, value: unknown): Promise<void>;
}) {
  if (view === "history") {
    return (
      <CommandHistoryWorkbench
        commandId={historyCommandId}
        history={history}
        isLoading={isLoading}
      />
    );
  }

  if (view === "settings") {
    return (
      <SettingsWorkbench
        commandCount={commands.length}
        pluginCount={plugins.length}
        historyCount={history.length}
        isLoading={isLoading}
        navigationMode={navigationMode}
        sidebarCollapsed={sidebarCollapsed}
        preferences={preferences}
        onOpenHistory={onOpenHistory}
        onRefresh={onRefresh}
        onSetPreference={onSetPreference}
      />
    );
  }

  if (selectedCommand || navigationMode === "entry-first") {
    return (
      <CommandWorkbench
        command={selectedCommand}
        plugin={selectedCommandPlugin}
        input={input}
        isLoading={isLoading}
        result={result}
        runError={runError}
        onChangeInput={onChangeInput}
        onOpenHistory={onOpenHistory}
      />
    );
  }

  return (
    <PluginWorkbench
      plugin={selectedPlugin}
      commands={selectedPluginCommands}
      isLoading={isLoading}
      onSelectCommand={onSelectCommand}
      onSetEnabled={onSetPluginEnabled}
    />
  );
}
