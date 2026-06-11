import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { Button } from "antd";
import { Play, RefreshCw, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getNavigationMode, getSidebarCollapsed } from "@/renderer/app/selectors";
import { useDesktopStore } from "@/renderer/app/store";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { SearchDialog } from "@/renderer/components/search/search-dialog";

import { getLocationPathname, getPageDescription, getPageTitle } from "./page-meta";
import { createSidebarRoutes } from "./sidebar-routes";
import { WorkbenchSwitch } from "./workbench-switch";

export function DesktopShell() {
  const state = useDesktopStore();
  const [searchOpen, setSearchOpen] = useState(false);
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
  const selectedPluginCommands = useMemo(
    () => state.commands.filter((command) => command.pluginId === selectedPlugin?.id),
    [selectedPlugin?.id, state.commands],
  );

  useEffect(() => {
    void state.loadData();
  }, [state.loadData]);

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
        commands: state.commands,
        plugins: state.plugins,
        onOpenSearch: () => setSearchOpen(true),
        onSelectCommand: state.selectCommand,
        onSelectPlugin: state.selectPlugin,
      }),
    [navigationMode, state.commands, state.plugins, state.selectCommand, state.selectPlugin],
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
      menuFooterRender={(props) => (
        <button
          type="button"
          aria-current={state.view === "settings" ? "page" : undefined}
          className={`tooldeck-sidebar-footer-action ${
            state.view === "settings" ? "tooldeck-sidebar-footer-action-selected" : ""
          } ${props?.collapsed ? "tooldeck-sidebar-footer-action-collapsed" : ""}`}
          onClick={() => state.setView("settings")}
        >
          <Settings size={15} />
          {props?.collapsed ? null : <span>Settings</span>}
        </button>
      )}
      onCollapse={(collapsed) => state.setPreference("desktop", "sidebar.collapsed", collapsed)}
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
                !selectedCommand.pluginEnabled || state.isLoadingData || state.isRunning
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

          <WorkbenchSwitch
            view={state.view}
            navigationMode={navigationMode}
            selectedCommand={selectedCommand}
            selectedCommandPlugin={selectedCommandPlugin}
            selectedPlugin={selectedPlugin}
            selectedPluginCommands={selectedPluginCommands}
            input={state.input}
            isLoading={state.isLoadingData}
            result={state.result}
            runError={state.runError}
            historyCommandId={state.historyCommandId}
            history={state.history}
            commands={state.commands}
            plugins={state.plugins}
            preferences={state.preferences}
            sidebarCollapsed={sidebarCollapsed}
            onChangeInput={state.updateInput}
            onOpenHistory={state.openCommandHistory}
            onSelectCommand={state.selectCommand}
            onSetPluginEnabled={state.setPluginEnabled}
            onRefresh={state.rescanPlugins}
            onSetPreference={state.setPreference}
          />
        </div>
      </PageContainer>
      <SearchDialog
        open={searchOpen}
        commands={state.commands}
        plugins={state.plugins}
        onClose={() => setSearchOpen(false)}
        onSelectCommand={state.selectCommand}
        onSelectPlugin={state.selectPlugin}
      />
    </ProLayout>
  );
}
