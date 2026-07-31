import type { ApplicationPreference, PreferenceScope } from "@tooldeck/application-node";
import type { JsonValue } from "@tooldeck/protocol";

import { withCliApplication } from "../application";
import { serializeError } from "../serialize-error";

const preferenceScopes: readonly PreferenceScope[] = ["cli", "desktop", "shared"];

export interface ListCliPreferencesOptions {
  storagePath: string;
}

export interface GetCliPreferenceOptions {
  key: string;
  storagePath: string;
}

export interface SetCliPreferenceOptions {
  key: string;
  storagePath: string;
  value: unknown;
}

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

export function listCliPreferences(
  options: ListCliPreferencesOptions,
): Promise<ListedCliPreference[]> {
  return withCliApplication(options, async (application) =>
    (await application.preferences.list()).map(formatListedPreference),
  );
}

export function getCliPreference(options: GetCliPreferenceOptions): Promise<unknown> {
  return withCliApplication(options, async (application) => {
    const preference = await requireCliPreference(application.preferences.list(), options.key);

    return (
      await application.preferences.get({
        scope: preference.scope,
        key: preference.key,
      })
    ).value;
  });
}

export async function getCliOutputFormat(options: {
  storagePath: string;
}): Promise<CliOutputFormat> {
  return (await getCliPreference({
    key: "output.format",
    storagePath: options.storagePath,
  })) as CliOutputFormat;
}

export function setCliPreference(options: SetCliPreferenceOptions): Promise<ListedCliPreference> {
  return withCliApplication(options, async (application) => {
    const preference = await requireCliPreference(application.preferences.list(), options.key);
    const updated = await application.preferences.set({
      scope: preference.scope,
      key: preference.key,
      value: options.value as JsonValue,
    });

    return formatListedPreference(updated);
  });
}

export function deleteCliPreference(options: DeleteCliPreferenceOptions): Promise<void> {
  return withCliApplication(options, async (application) => {
    const preference = await requireCliPreference(application.preferences.list(), options.key);

    await application.preferences.delete({
      scope: preference.scope,
      key: preference.key,
    });
  });
}

export function parsePreferenceJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Preference value must be valid JSON: ${serializeError(error).message}`);
  }
}

function formatListedPreference(preference: ApplicationPreference): ListedCliPreference {
  return {
    scope: preference.scope,
    key: preference.key,
    value: preference.value,
    ...(preference.updatedAt === undefined ? {} : { updatedAt: preference.updatedAt }),
  };
}

async function requireCliPreference(
  preferencesPromise: Promise<ApplicationPreference[]>,
  key: string,
): Promise<ApplicationPreference> {
  const preferences = await preferencesPromise;
  const scoped = parseScopedPreferenceKey(key);

  if (scoped) {
    const matching = preferences.find(
      (preference) => preference.scope === scoped.scope && preference.key === scoped.key,
    );

    if (matching) {
      return matching;
    }
  } else {
    const matching = preferences.filter((preference) => preference.key === key);

    if (matching.length === 1) {
      return matching[0]!;
    }

    if (matching.length > 1) {
      throw new Error(`Ambiguous preference key: ${key}\nUse a scoped preference key instead.`);
    }
  }

  throw new Error(
    `Unsupported preference key: ${key}\nSupported preference keys: ${preferences
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
