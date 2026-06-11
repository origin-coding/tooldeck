import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

import type { DesktopNavigationMode } from "./types";

export function resolveSelectedCommandId(
  commands: DesktopCommand[],
  selectedCommandId: string | undefined,
): string | undefined {
  if (selectedCommandId && commands.some((command) => command.id === selectedCommandId)) {
    return selectedCommandId;
  }

  return commands[0]?.id;
}

export function resolveSelectedPluginId(
  plugins: DesktopPlugin[],
  selectedPluginId: string | undefined,
  selectedCommand: DesktopCommand | undefined,
): string | undefined {
  if (selectedPluginId && plugins.some((plugin) => plugin.id === selectedPluginId)) {
    return selectedPluginId;
  }

  if (
    selectedCommand?.pluginId &&
    plugins.some((plugin) => plugin.id === selectedCommand.pluginId)
  ) {
    return selectedCommand.pluginId;
  }

  return plugins[0]?.id;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getNavigationMode(
  preferences: { scope: string; key: string; value: unknown }[],
): DesktopNavigationMode {
  const value = preferences.find(
    (preference) => preference.scope === "desktop" && preference.key === "navigation.mode",
  )?.value;

  return value === "entry-first" ? "entry-first" : "provider-first";
}

export function getSidebarCollapsed(
  preferences: { scope: string; key: string; value: unknown }[],
): boolean {
  return (
    preferences.find(
      (preference) => preference.scope === "desktop" && preference.key === "sidebar.collapsed",
    )?.value === true
  );
}
