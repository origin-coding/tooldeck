import {
  listPreferenceDefinitions,
  requirePreferenceDefinition,
  validatePreferenceValue,
  type PreferenceDefinition,
  type PreferenceScope,
} from "@tooldeck/preferences";
import {
  PreferenceRepository,
  type PreferenceRow,
  type SetPreferenceInput,
  withRepository,
} from "@tooldeck/storage";

import { serializeError } from "./serialize-error";

const preferenceScopes: readonly PreferenceScope[] = ["cli", "desktop", "shared"];

export interface ListCliPreferencesOptions {
  storagePath: string;
}

export interface GetCliPreferenceOptions {
  key: string;
  storagePath: string;
}

export type SetCliPreferenceOptions = Omit<SetPreferenceInput, "scope"> & {
  storagePath: string;
};

export interface DeleteCliPreferenceOptions {
  key: string;
  storagePath: string;
}

export interface ListedCliPreference {
  scope: PreferenceScope;
  key: string;
  value: unknown;
  updatedAt?: number;
}

export type CliOutputFormat = "text" | "json";

export async function listCliPreferences(
  options: ListCliPreferencesOptions,
): Promise<ListedCliPreference[]> {
  return withRepository(
    options.storagePath,
    (db) => new PreferenceRepository(db),
    (preferences) =>
      listPreferenceDefinitions().map((definition) =>
        formatListedPreference(definition, preferences.getRow(definition.scope, definition.key)),
      ),
  );
}

export async function getCliPreference(options: GetCliPreferenceOptions): Promise<unknown> {
  const definition = requireCliPreferenceDefinition(options.key);

  return withRepository(
    options.storagePath,
    (db) => new PreferenceRepository(db),
    (preferences) => {
      const value = preferences.get(definition.scope, definition.key);

      if (value === undefined) {
        return definition.defaultValue;
      }

      return validatePreferenceValue(definition.scope, definition.key, value);
    },
  );
}

export async function getCliOutputFormat(options: {
  storagePath: string;
}): Promise<CliOutputFormat> {
  return (await getCliPreference({
    key: "output.format",
    storagePath: options.storagePath,
  })) as CliOutputFormat;
}

export async function setCliPreference(
  options: SetCliPreferenceOptions,
): Promise<ListedCliPreference> {
  const definition = requireCliPreferenceDefinition(options.key);
  const value = validatePreferenceValue(definition.scope, definition.key, options.value);

  return withRepository(
    options.storagePath,
    (db) => new PreferenceRepository(db),
    (preferences) =>
      formatListedPreference(
        definition,
        preferences.set({
          scope: definition.scope,
          key: definition.key,
          value,
          now: options.now,
        }),
      ),
  );
}

export async function deleteCliPreference(options: DeleteCliPreferenceOptions): Promise<void> {
  const definition = requireCliPreferenceDefinition(options.key);

  return withRepository(
    options.storagePath,
    (db) => new PreferenceRepository(db),
    (preferences) => {
      preferences.delete(definition.scope, definition.key);
    },
  );
}

export function parsePreferenceJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Preference value must be valid JSON: ${serializeError(error).message}`);
  }
}

function formatListedPreference(
  definition: PreferenceDefinition,
  preference?: PreferenceRow,
): ListedCliPreference {
  return {
    scope: definition.scope,
    key: definition.key,
    value: preference
      ? validatePreferenceValue(definition.scope, definition.key, JSON.parse(preference.valueJson))
      : definition.defaultValue,
    ...(preference ? { updatedAt: preference.updatedAt } : {}),
  };
}

function requireCliPreferenceDefinition(key: string): PreferenceDefinition {
  const scoped = parseScopedPreferenceKey(key);

  if (scoped) {
    return requirePreferenceDefinition(scoped.scope, scoped.key);
  }

  const matching = listPreferenceDefinitions().filter((definition) => definition.key === key);

  if (matching.length === 1) {
    return matching[0]!;
  }

  if (matching.length > 1) {
    throw new Error(`Ambiguous preference key: ${key}\nUse a scoped preference key instead.`);
  }

  throw new Error(
    `Unsupported preference key: ${key}\nSupported preference keys: ${listPreferenceDefinitions()
      .map((known) => known.key)
      .join(", ")}`,
  );
}

function parseScopedPreferenceKey(
  key: string,
): { scope: PreferenceScope; key: string } | undefined {
  for (const scope of preferenceScopes) {
    const prefix = `${scope}.`;

    if (key.startsWith(prefix)) {
      return {
        scope,
        key: key.slice(prefix.length),
      };
    }
  }

  return undefined;
}
