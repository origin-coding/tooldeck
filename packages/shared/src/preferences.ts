import type { JsonValue } from "./types";

export type PreferenceScope = "cli" | "desktop" | "shared";

export type SharedPreferenceKey = "locale";

export type CliPreferenceKey = "output.format" | "command.history.enabled";

export type DesktopPreferenceKey = "navigation.mode" | "sidebar.collapsed";

export type KnownPreferenceKey = SharedPreferenceKey | CliPreferenceKey | DesktopPreferenceKey;

export type KnownPreferenceValue = string | boolean;

export interface PreferenceDefinition {
  scope: PreferenceScope;
  key: KnownPreferenceKey;
  defaultValue: KnownPreferenceValue;
  description: string;
  values?: readonly string[];
  valueType: "boolean" | "enum";
}

export const preferenceDefinitions = [
  {
    scope: "shared",
    key: "locale",
    valueType: "enum",
    defaultValue: "system",
    values: ["system", "en-US", "zh-CN"],
    description: "Default locale used by Tooldeck surfaces.",
  },
  {
    scope: "cli",
    key: "output.format",
    valueType: "enum",
    defaultValue: "text",
    values: ["text", "json"],
    description: "Default CLI output format.",
  },
  {
    scope: "cli",
    key: "command.history.enabled",
    valueType: "boolean",
    defaultValue: true,
    description: "Whether CLI command runs are recorded in command history.",
  },
  {
    scope: "desktop",
    key: "navigation.mode",
    valueType: "enum",
    defaultValue: "provider-first",
    values: ["provider-first", "entry-first"],
    description: "How the desktop sidebar organizes plugins and entries.",
  },
  {
    scope: "desktop",
    key: "sidebar.collapsed",
    valueType: "boolean",
    defaultValue: false,
    description: "Whether the desktop sidebar is collapsed.",
  },
] as const satisfies readonly PreferenceDefinition[];

export function listPreferenceDefinitions(): readonly PreferenceDefinition[] {
  return preferenceDefinitions;
}

export function getPreferenceDefinition(
  scope: PreferenceScope,
  key: string,
): PreferenceDefinition | undefined {
  return preferenceDefinitions.find(
    (definition) => definition.scope === scope && definition.key === key,
  );
}

export function requirePreferenceDefinition(
  scope: PreferenceScope,
  key: string,
): PreferenceDefinition {
  const definition = getPreferenceDefinition(scope, key);

  if (!definition) {
    throw new Error(
      `Unsupported preference key: ${scope}.${key}\nSupported preference keys: ${preferenceDefinitions
        .map((known) => `${known.scope}.${known.key}`)
        .join(", ")}`,
    );
  }

  return definition;
}

export function validatePreferenceValue(
  scope: PreferenceScope,
  key: string,
  value: unknown,
): JsonValue {
  const definition = requirePreferenceDefinition(scope, key);

  if (definition.valueType === "boolean") {
    if (typeof value !== "boolean") {
      throw new TypeError(`Preference ${key} must be a boolean value`);
    }

    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError(`Preference ${key} must be a string value`);
  }

  if (!definition.values?.includes(value)) {
    throw new TypeError(`Preference ${key} must be one of: ${definition.values?.join(", ") ?? ""}`);
  }

  return value;
}
