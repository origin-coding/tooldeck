import { PageContainer, ProLayout } from "@ant-design/pro-components";
import { Button } from "antd";
import { Play, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { getNavigationMode, getSidebarCollapsed } from "@/renderer/app/selectors";
import { useDesktopStore } from "@/renderer/app/store";
import { ErrorNotice } from "@/renderer/components/common/error-notice";
import { SearchDialog } from "@/renderer/components/search/search-dialog";

import { getLocationPathname, getPageDescription, getPageTitle } from "./page-meta";
import { createSidebarRoutes } from "./sidebar-routes";
import { WorkbenchSwitch } from "./workbench-switch";

export function DesktopShell() {
  const { t } = useTranslation();
  const {
    commands,
    plugins,
    preferences,
    selectedCommandId,
    selectedPluginId,
    historyCommandId,
    isLoadingData,
    isRunning,
    loadError,
    pluginInstall,
    view,
  } = useDesktopStore(
    useShallow((state) => ({
      commands: state.commands,
      plugins: state.plugins,
      preferences: state.preferences,
      selectedCommandId: state.selectedCommandId,
      selectedPluginId: state.selectedPluginId,
      historyCommandId: state.historyCommandId,
      isLoadingData: state.isLoadingData,
      isRunning: state.isRunning,
      loadError: state.loadError,
      pluginInstall: state.pluginInstall,
      view: state.view,
    })),
  );
  const { loadData, runSelectedCommand, selectCommand, selectPlugin, setPreference, setView } =
    useDesktopStore(
      useShallow((state) => ({
        loadData: state.loadData,
        runSelectedCommand: state.runSelectedCommand,
        selectCommand: state.selectCommand,
        selectPlugin: state.selectPlugin,
        setPreference: state.setPreference,
        setView: state.setView,
      })),
    );
  const [searchOpen, setSearchOpen] = useState(false);
  const navigationMode = getNavigationMode(preferences);
  const sidebarCollapsed = getSidebarCollapsed(preferences);

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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const pageTitle = getPageTitle({
    view,
    selectedCommand,
    selectedPlugin,
    isLoading: isLoadingData,
    historyCommandId,
    navigationMode,
    t,
  });
  const pageDescription = getPageDescription({
    view,
    selectedCommand,
    selectedPlugin,
    t,
  });
  const locationPathname = getLocationPathname({
    view,
    selectedCommandId,
    selectedPluginId: selectedPlugin?.id,
    navigationMode,
  });
  const sidebarRoutes = useMemo(
    () =>
      createSidebarRoutes({
        mode: navigationMode,
        commands,
        plugins,
        labels: {
          search: t("navigation.search"),
          commands: t("common.commands"),
          plugins: t("common.plugins"),
          noCommandsFound: t("navigation.noCommandsFound"),
          noPluginsFound: t("navigation.noPluginsFound"),
        },
        onOpenSearch: () => setSearchOpen(true),
        onSelectCommand: selectCommand,
        onSelectPlugin: selectPlugin,
      }),
    [navigationMode, commands, plugins, selectCommand, selectPlugin, t],
  );

  return (
    <ProLayout
      className="tooldeck-pro-layout"
      collapsed={sidebarCollapsed}
      collapsedButtonRender={(_collapsed, defaultDom) => defaultDom}
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
          aria-current={view === "settings" ? "page" : undefined}
          className={`tooldeck-sidebar-footer-action ${
            view === "settings" ? "tooldeck-sidebar-footer-action-selected" : ""
          } ${props?.collapsed ? "tooldeck-sidebar-footer-action-collapsed" : ""}`}
          onClick={() => setView("settings")}
        >
          <Settings size={15} />
          {props?.collapsed ? null : <span>{t("common.settings")}</span>}
        </button>
      )}
      onCollapse={(collapsed) => setPreference("desktop", "sidebar.collapsed", collapsed)}
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
          view === "main" && selectedCommand ? (
            <Button
              key="run"
              disabled={
                !selectedCommand.pluginEnabled ||
                isLoadingData ||
                isRunning ||
                pluginInstall.status === "refresh-failed"
              }
              htmlType="button"
              icon={<Play size={15} />}
              loading={isRunning}
              onClick={runSelectedCommand}
              type="primary"
            >
              {t("common.run")}
            </Button>
          ) : null,
        ].filter(Boolean)}
        title={pageTitle}
      >
        <div className="grid w-full gap-4">
          {loadError ? <ErrorNotice message={loadError} title={t("shell.loadFailed")} /> : null}

          <WorkbenchSwitch view={view} navigationMode={navigationMode} />
        </div>
      </PageContainer>
      <SearchDialog
        open={searchOpen}
        commands={commands}
        plugins={plugins}
        onClose={() => setSearchOpen(false)}
        onSelectCommand={selectCommand}
        onSelectPlugin={selectPlugin}
      />
    </ProLayout>
  );
}
