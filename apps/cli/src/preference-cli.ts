import { defineCommand } from "citty";

import {
  deleteCliPreference,
  getCliOutputFormat,
  getCliPreference,
  listCliPreferences,
  parsePreferenceJson,
  setCliPreference,
  type CliOutputFormat,
} from "./preference-operations";
import { printPreferenceList, printPreferenceValue } from "./preference-output";
import {
  createStorageCommandArg,
  requireCliArgument,
  resolveCliRuntimePaths,
  type CreateCliCommandOptions,
} from "./runtime";

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
          description: "List known Tooldeck preferences.",
        },
        args: createPreferenceCommandArgs(),
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            ...options,
            storage: args.storage,
          });
          const preferences = await listCliPreferences({
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPreferenceList(preferences, outputFormat);
        },
      }),
      get: defineCommand({
        meta: {
          name: "get",
          description: "Print a Tooldeck preference value.",
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
            ...options,
            storage: args.storage,
          });
          const value = await getCliPreference({
            key: requireCliArgument(args.key, "key"),
            storagePath,
          });
          const outputFormat = await getCliOutputFormat({ storagePath });

          printPreferenceValue(value, outputFormat);
        },
      }),
      set: defineCommand({
        meta: {
          name: "set",
          description: "Store a known Tooldeck preference value.",
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
            description: "Preference value as JSON.",
            valueHint: "value",
          },
          ...createPreferenceCommandArgs(),
        },
        async run({ args }) {
          const { storagePath } = resolveCliRuntimePaths({
            ...options,
            storage: args.storage,
          });
          const preference = await setCliPreference({
            key: requireCliArgument(args.key, "key"),
            value: parsePreferenceJson(requireCliArgument(args.value, "value")),
            storagePath,
          });
          const outputFormat =
            preference.key === "output.format"
              ? (preference.value as CliOutputFormat)
              : await getCliOutputFormat({ storagePath });

          printPreferenceList([preference], outputFormat);
        },
      }),
      delete: defineCommand({
        meta: {
          name: "delete",
          description: "Delete a stored Tooldeck preference override.",
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
            ...options,
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

function createPreferenceCommandArgs() {
  return {
    storage: createStorageCommandArg("SQLite database path for preferences."),
  };
}
