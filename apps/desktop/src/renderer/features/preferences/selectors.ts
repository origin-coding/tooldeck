export type DesktopNavigationMode = "provider-first" | "entry-first";

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
