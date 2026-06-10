import {
  PreferenceRepository,
  type PreferenceRow,
  type SetPreferenceInput,
  withRepository,
} from "@tooldeck/storage";
import { defineCommand } from "citty";
import { consola } from "consola";

import { formatPreferenceList, formatPreferenceValue } from "./output";
import {
  createStorageCommandArg,
  requireCliArgument,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

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
  scope: "cli";
  key: string;
  value: unknown;
  updatedAt: number;
}

export async function listCliPreferences(
  options: ListCliPreferencesOptions,
): Promise<ListedCliPreference[]> {
  return withRepository(options.storagePath, (db) => new PreferenceRepository(db), (preferences) =>
    preferences.list("cli").map(formatListedPreference),
  );
}

export async function getCliPreference(
  options: GetCliPreferenceOptions,
): Promise<unknown | undefined> {
  return withRepository(options.storagePath, (db) => new PreferenceRepository(db), (preferences) =>
    preferences.get("cli", options.key),
  );
}

export async function setCliPreference(
  options: SetCliPreferenceOptions,
): Promise<ListedCliPreference> {
  return withRepository(options.storagePath, (db) => new PreferenceRepository(db), (preferences) =>
    formatListedPreference(
      preferences.set({
        scope: "cli",
        key: options.key,
        value: options.value,
        now: options.now,
      }),
    ),
  );
}

export async function deleteCliPreference(options: DeleteCliPreferenceOptions): Promise<void> {
  return withRepository(options.storagePath, (db) => new PreferenceRepository(db), (preferences) => {
    preferences.delete("cli", options.key);
  });
}

export function definePreferenceCommand(options: CreateCliCommandOptions) {
  return defineCommand({
    meta: {
      name: "preference",
      description: "Manage Tooldeck CLI preferences.",
    },
    subCommands: {
      list: defineCommand({
        meta: {
          name: "list",
          description: "List stored CLI preferences.",
        },
        args: createPreferenceCommandArgs(),
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            storage: args.storage,
          });
          const preferences = await listCliPreferences({
            storagePath,
          });

          printPreferenceList(preferences);
        },
      }),
      get: defineCommand({
        meta: {
          name: "get",
          description: "Print a stored CLI preference value.",
        },
        args: {
          key: {
            type: "positional",
            required: true,
            description: "Preference key.",
            valueHint: "key",
          },
          ...createPreferenceCommandArgs(),
        },
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            storage: args.storage,
          });
          const value = await getCliPreference({
            key: requireCliArgument(args.key, "key"),
            storagePath,
          });

          printPreferenceValue(value);
        },
      }),
      set: defineCommand({
        meta: {
          name: "set",
          description: "Store a JSON CLI preference value.",
        },
        args: {
          key: {
            type: "positional",
            required: true,
            description: "Preference key.",
            valueHint: "key",
          },
          value: {
            type: "positional",
            required: true,
            description: "JSON preference value.",
            valueHint: "json",
          },
          ...createPreferenceCommandArgs(),
        },
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            storage: args.storage,
          });
          const preference = await setCliPreference({
            key: requireCliArgument(args.key, "key"),
            value: parsePreferenceJson(requireCliArgument(args.value, "value")),
            storagePath,
          });

          printPreferenceList([preference]);
        },
      }),
      delete: defineCommand({
        meta: {
          name: "delete",
          description: "Delete a stored CLI preference.",
        },
        args: {
          key: {
            type: "positional",
            required: true,
            description: "Preference key.",
            valueHint: "key",
          },
          ...createPreferenceCommandArgs(),
        },
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            workspaceRoot: options.workspaceRoot,
            storage: args.storage,
          });

          await deleteCliPreference({
            key: requireCliArgument(args.key, "key"),
            storagePath,
          });
        },
      }),
    },
  });
}

export function printPreferenceList(preferences: ListedCliPreference[]): void {
  consola.log(formatPreferenceList(preferences));
}

export function printPreferenceValue(value: unknown): void {
  if (value === undefined) {
    consola.error("Preference not found.");
    process.exitCode = 1;
    return;
  }

  consola.log(formatPreferenceValue(value));
}

export function parsePreferenceJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Preference value must be valid JSON: ${serializeError(error).message}`);
  }
}

function formatListedPreference(preference: PreferenceRow): ListedCliPreference {
  return {
    scope: "cli",
    key: preference.key,
    value: JSON.parse(preference.valueJson),
    updatedAt: preference.updatedAt,
  };
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function createPreferenceCommandArgs() {
  return {
    storage: createStorageCommandArg("SQLite database path for preferences."),
  };
}
