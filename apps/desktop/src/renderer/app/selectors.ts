import type { DesktopNavigationMode } from "./types";

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
