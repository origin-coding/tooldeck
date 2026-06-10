import type { JsonValue } from "./types";

export type PreferenceScope = "cli" | "desktop" | "shared";

export type SharedPreferenceKey = "locale";

export type CliPreferenceKey = "output.format" | "command.history.enabled";

export type KnownPreferenceKey = SharedPreferenceKey | CliPreferenceKey;

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
] as const satisfies readonly PreferenceDefinition[];

export function listPreferenceDefinitions(): readonly PreferenceDefinition[] {
  return preferenceDefinitions;
}

export function getPreferenceDefinition(key: string): PreferenceDefinition | undefined {
  return preferenceDefinitions.find((definition) => definition.key === key);
}

export function requirePreferenceDefinition(key: string): PreferenceDefinition {
  const definition = getPreferenceDefinition(key);

  if (!definition) {
    throw new Error(
      `Unsupported preference key: ${key}\nSupported preference keys: ${preferenceDefinitions
        .map((known) => known.key)
        .join(", ")}`,
    );
  }

  return definition;
}

export function validatePreferenceValue(key: string, value: unknown): JsonValue {
  const definition = requirePreferenceDefinition(key);

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
