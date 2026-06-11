import type { DesktopNavigationMode } from "@/renderer/app/types";

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

export function getPageDescription({
  view,
  selectedCommand,
  selectedPlugin,
}: {
  view: string;
  selectedCommand?: { description?: string; id: string };
  selectedPlugin?: { description?: string; id: string };
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

  return (
    selectedPlugin?.description ?? selectedPlugin?.id ?? "Select a plugin or command to inspect."
  );
}
