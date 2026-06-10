import {type MenuDataItem, PageContainer, ProLayout} from "@ant-design/pro-components";
import {Button, Input} from "antd";
import {Boxes, Play, RefreshCw, Search, Settings, Wrench} from "lucide-react";
import {type ReactNode, useEffect, useMemo} from "react";

import {filterCommands, filterPlugins} from "@/renderer/app/selectors";
import {useDesktopStore} from "@/renderer/app/store";
import type {DesktopNavigationMode} from "@/renderer/app/types";
import {CommandWorkbench} from "@/renderer/components/commands/command-workbench";
import {ErrorNotice} from "@/renderer/components/common/error-notice";
import {CommandHistoryWorkbench} from "@/renderer/components/history/command-history-workbench";
import {PluginWorkbench} from "@/renderer/components/plugins/plugin-workbench";
import {SettingsWorkbench} from "@/renderer/components/settings/settings-workbench";
import type {DesktopCommand, DesktopPlugin} from "@/shared/desktop-api";

type SidebarRoute = MenuDataItem & {
  path: string;
  key: string;
  name: string;
  locale: false;
  icon: ReactNode;
  children?: SidebarRoute[];
  disabled?: boolean;
  kind?: "command" | "plugin";
  commandId?: string;
  pluginId?: string;
  onTitleClick?: () => void;
};

export function App() {
  const state = useDesktopStore();
  const navigationMode = getNavigationMode(state.preferences);
  const sidebarCollapsed = getSidebarCollapsed(state.preferences);

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

  const mainContent =
    selectedCommand || navigationMode === "entry-first" ? (
      <CommandWorkbench
        command={selectedCommand}
        plugin={selectedCommandPlugin}
        input={state.input}
        isLoading={state.isLoadingData}
        result={state.result}
        runError={state.runError}
        onChangeInput={state.updateInput}
        onOpenHistory={state.openCommandHistory}
      />
    ) : (
      <PluginWorkbench
        plugin={selectedPlugin}
        commands={selectedPluginCommands}
        isLoading={state.isLoadingData}
        onSelectCommand={state.selectCommand}
        onSetEnabled={state.setPluginEnabled}
      />
    );

  const pageTitle = getPageTitle({
    view: state.view,
    selectedCommand,
    selectedPlugin,
    isLoading: state.isLoadingData,
    historyCommandId: state.historyCommandId,
    navigationMode,
  });
  const pageDescription = getPageDescription({
    view: state.view,
    selectedCommand,
    selectedPlugin,
  });
  const locationPathname = getLocationPathname({
    view: state.view,
    selectedCommandId: state.selectedCommandId,
    selectedPluginId: selectedPlugin?.id,
    navigationMode,
  });
  const sidebarRoutes = useMemo(
    () =>
      createSidebarRoutes({
        mode: navigationMode,
        commands: filteredCommands,
        plugins: filteredPlugins,
        onOpenSettings: () => state.setView("settings"),
        onSelectCommand: state.selectCommand,
        onSelectPlugin: state.selectPlugin,
      }),
    [
      filteredCommands,
      filteredPlugins,
      navigationMode,
      state.selectCommand,
      state.selectPlugin,
      state.setView,
    ],
  );

  return (
    <ProLayout
      className="tooldeck-pro-layout"
      collapsed={sidebarCollapsed}
      collapsedButtonRender={(collapsed, defaultDom) => defaultDom}
      contentStyle={{ minHeight: 0 }}
      disableMobile
      fixedHeader
      fixSiderbar
      footerRender={false}
      layout="side"
      location={{ pathname: locationPathname }}
      logo={
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
          {"{}"}
        </div>
      }
      title={"Tooldeck"}
      menu={{ defaultOpenAll: true, locale: false, type: "group" }}
      menuExtraRender={(props) =>
        props.collapsed ? null : (
          <div className="px-4 pt-2 pb-2.5">
            <div className="text-[13px] font-semibold text-gray-900">
              {navigationMode === "entry-first" ? "Entries" : "Providers"}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {navigationMode === "entry-first" ? "Browse commands directly" : "Browse by plugin"}
            </div>
            <Input
              allowClear
              className="mt-2"
              placeholder={navigationMode === "entry-first" ? "Search commands" : "Search plugins"}
              prefix={<Search size={15} />}
              value={navigationMode === "entry-first" ? state.commandQuery : state.pluginQuery}
              onChange={(event) =>
                navigationMode === "entry-first"
                  ? state.setCommandQuery(event.target.value)
                  : state.setPluginQuery(event.target.value)
              }
            />
          </div>
        )
      }
      onCollapse={(collapsed) => state.setPreference("desktop.sidebar.collapsed", collapsed)}
      pageTitleRender={false}
      route={{
        path: "/",
        children: sidebarRoutes,
      }}
    >
      <PageContainer
        breadcrumbRender={false}
        className="tooldeck-page-container"
        content={pageDescription}
        extra={[
          <Button
            key="refresh"
            disabled={state.isLoadingData}
            htmlType="button"
            icon={
              <RefreshCw className={state.isLoadingData ? "animate-spin" : undefined} size={15} />
            }
            onClick={state.rescanPlugins}
          >
            Rescan
          </Button>,
          state.view === "main" && selectedCommand ? (
            <Button
              key="run"
              disabled={
                !selectedCommand ||
                !selectedCommand.pluginEnabled ||
                state.isLoadingData ||
                state.isRunning
              }
              htmlType="button"
              icon={<Play size={15} />}
              loading={state.isRunning}
              onClick={state.runSelectedCommand}
              type="primary"
            >
              Run
            </Button>
          ) : null,
        ].filter(Boolean)}
        title={pageTitle}
      >
        <div className="grid w-full gap-4">
          {state.loadError ? <ErrorNotice message={state.loadError} title="Load failed" /> : null}

          {state.view === "main" ? (
            mainContent
          ) : state.view === "history" ? (
            <CommandHistoryWorkbench
              commandId={state.historyCommandId}
              history={state.history}
              isLoading={state.isLoadingData}
            />
          ) : (
            <SettingsWorkbench
              commandCount={state.commands.length}
              pluginCount={state.plugins.length}
              historyCount={state.history.length}
              isLoading={state.isLoadingData}
              navigationMode={navigationMode}
              sidebarCollapsed={sidebarCollapsed}
              preferences={state.preferences}
              onOpenHistory={state.openCommandHistory}
              onRefresh={state.rescanPlugins}
              onSetPreference={state.setPreference}
            />
          )}
        </div>
      </PageContainer>
    </ProLayout>
  );
}

function createSidebarRoutes({
  mode,
  commands,
  plugins,
  onOpenSettings,
  onSelectCommand,
  onSelectPlugin,
}: {
  mode: DesktopNavigationMode;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  onOpenSettings(): void;
  onSelectCommand(command: DesktopCommand): void;
  onSelectPlugin(plugin: DesktopPlugin): void;
}): SidebarRoute[] {
  const settingsRoute: SidebarRoute = {
    path: "/settings",
    key: "settings",
    name: "Settings",
    locale: false,
    icon: <Settings size={15} />,
    onTitleClick: onOpenSettings,
  };

  if (mode === "entry-first") {
    const commandRoutes: SidebarRoute[] =
      commands.length > 0
        ? commands.map((command) => ({
            path: `/commands/${encodeURIComponent(command.id)}`,
            key: `command:${command.id}`,
            name: command.title,
            locale: false,
            icon: <Wrench size={15} />,
            kind: "command",
            commandId: command.id,
            onTitleClick: () => onSelectCommand(command),
          }))
        : [
            {
              path: "/commands/empty",
              key: "commands-empty",
              name: "No commands found",
              locale: false,
              icon: <Wrench size={15} />,
              disabled: true,
            },
          ];

    return [
      {
        path: "/commands",
        key: "commands",
        name: "Commands",
        locale: false,
        icon: <Wrench size={15} />,
        children: commandRoutes,
      },
      settingsRoute,
    ];
  }

  const pluginRoutes: SidebarRoute[] =
    plugins.length > 0
      ? plugins.map((plugin) => ({
          path: `/plugins/${encodeURIComponent(plugin.id)}`,
          key: `plugin:${plugin.id}`,
          name: plugin.name,
          locale: false,
          icon: <Boxes size={15} />,
          kind: "plugin",
          pluginId: plugin.id,
          onTitleClick: () => onSelectPlugin(plugin),
        }))
      : [
          {
            path: "/plugins/empty",
            key: "plugins-empty",
            name: "No plugins found",
            locale: false,
            icon: <Boxes size={15} />,
            disabled: true,
          },
        ];

  return [
    {
      path: "/plugins",
      key: "plugins",
      name: "Plugins",
      locale: false,
      icon: <Boxes size={15} />,
      children: pluginRoutes,
    },
    settingsRoute,
  ];
}

function getLocationPathname({
  view,
  selectedCommandId,
  selectedPluginId,
  navigationMode,
}: {
  view: string;
  selectedCommandId?: string;
  selectedPluginId?: string;
  navigationMode: DesktopNavigationMode;
}): string {
  if (view === "settings") {
    return "/settings";
  }

  if (view === "history") {
    return "/history";
  }

  if (navigationMode === "entry-first" && selectedCommandId) {
    return `/commands/${encodeURIComponent(selectedCommandId)}`;
  }

  if (navigationMode === "provider-first" && selectedPluginId) {
    return `/plugins/${encodeURIComponent(selectedPluginId)}`;
  }

  return navigationMode === "entry-first" ? "/commands" : "/plugins";
}

function getPageTitle({
  view,
  selectedCommand,
  selectedPlugin,
  isLoading,
  historyCommandId,
  navigationMode,
}: {
  view: string;
  selectedCommand?: { title: string };
  selectedPlugin?: { name: string };
  isLoading: boolean;
  historyCommandId?: string;
  navigationMode: DesktopNavigationMode;
}): string {
  if (view === "settings") {
    return "Settings";
  }

  if (view === "history") {
    return historyCommandId ? `Command History: ${historyCommandId}` : "Command History";
  }

  if (selectedCommand) {
    return selectedCommand.title;
  }

  if (selectedPlugin) {
    return selectedPlugin.name;
  }

  if (isLoading) {
    return "Loading workspace";
  }

  return navigationMode === "entry-first" ? "Commands" : "Plugins";
}

function getPageDescription({
  view,
  selectedCommand,
  selectedPlugin,
}: {
  view: string;
  selectedCommand?: { description?: string; id: string };
  selectedPlugin?: { id: string };
}): string {
  if (view === "settings") {
    return "Local desktop preferences and workspace state";
  }

  if (view === "history") {
    return "Review recent command runs";
  }

  if (selectedCommand) {
    return selectedCommand.description ?? selectedCommand.id;
  }

  return selectedPlugin?.id ?? "Select a plugin or command to inspect.";
}

function getNavigationMode(preferences: { key: string; value: unknown }[]): DesktopNavigationMode {
  const value = preferences.find(
    (preference) => preference.key === "desktop.navigation.mode",
  )?.value;

  return value === "entry-first" ? "entry-first" : "provider-first";
}

function getSidebarCollapsed(preferences: { key: string; value: unknown }[]): boolean {
  return (
    preferences.find((preference) => preference.key === "desktop.sidebar.collapsed")?.value === true
  );
}
