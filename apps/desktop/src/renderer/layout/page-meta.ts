import type { DesktopNavigationMode } from "@/renderer/app/types";

export type PageMetaTranslator = (key: string, options?: Record<string, string | number>) => string;

export function getLocationPathname({
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

export function getPageTitle({
  view,
  selectedCommand,
  selectedPlugin,
  isLoading,
  historyCommandId,
  navigationMode,
  t,
}: {
  view: string;
  selectedCommand?: { title: string };
  selectedPlugin?: { name: string };
  isLoading: boolean;
  historyCommandId?: string;
  navigationMode: DesktopNavigationMode;
  t: PageMetaTranslator;
}): string {
  if (view === "settings") {
    return t("common.settings");
  }

  if (view === "history") {
    return historyCommandId
      ? t("page.commandHistoryFor", { commandId: historyCommandId })
      : t("page.commandHistory");
  }

  if (selectedCommand) {
    return selectedCommand.title;
  }

  if (selectedPlugin) {
    return selectedPlugin.name;
  }

  if (isLoading) {
    return t("page.loadingWorkspace");
  }

  return navigationMode === "entry-first" ? t("common.commands") : t("common.plugins");
}

export function getPageDescription({
  view,
  selectedCommand,
  selectedPlugin,
  t,
}: {
  view: string;
  selectedCommand?: { description?: string; id: string };
  selectedPlugin?: { description?: string; id: string };
  t: PageMetaTranslator;
}): string {
  if (view === "settings") {
    return t("page.settingsDescription");
  }

  if (view === "history") {
    return t("page.historyDescription");
  }

  if (selectedCommand) {
    return selectedCommand.description ?? selectedCommand.id;
  }

  return selectedPlugin?.description ?? selectedPlugin?.id ?? t("page.emptyDescription");
}
