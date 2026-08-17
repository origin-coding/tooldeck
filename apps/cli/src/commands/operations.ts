import path from "node:path";

import type { ApplicationCommand, ApplicationPluginSource } from "@tooldeck/application-node";
import type { CommandResult, JsonObject, LocalizedString } from "@tooldeck/protocol";

import { withCliApplication } from "../application";
import { parseRawCommandInputFromCliArgs } from "./input";

export interface RunCliCommandOptions {
  commandId: string;
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath: string;
  input?: JsonObject;
  rawArgs?: string[];
}

export interface ListCliCommandsOptions {
  pluginsRoot?: string;
  pluginSources?: ApplicationPluginSource[];
  storagePath?: string;
}

export interface ListedCliCommand {
  id: string;
  pluginId: string;
  title: string;
  description?: string;
}

export async function listCliCommands(
  options: ListCliCommandsOptions,
): Promise<ListedCliCommand[]> {
  const storagePath = options.storagePath ?? resolveDefaultStoragePath(options);

  return withCliApplication(
    {
      pluginsRoot: options.pluginsRoot,
      pluginSources: options.pluginSources,
      storagePath,
    },
    async (application) => (await application.commands.list()).map(formatListedCommand),
  );
}

export function runCliCommandWithStorage(options: RunCliCommandOptions): Promise<CommandResult> {
  return withCliApplication(
    {
      pluginsRoot: options.pluginsRoot,
      pluginSources: options.pluginSources,
      storagePath: options.storagePath,
    },
    async (application) => {
      const historyPreference = await application.preferences.get({
        scope: "cli",
        key: "command.history.enabled",
      });
      const input =
        options.input ??
        parseRawCommandInputFromCliArgs({
          rawArgs: options.rawArgs ?? [],
          commandId: options.commandId,
          ignoredOptions: ["plugins", "plugin-dir", "pluginDir", "storage"],
        });

      return application.commands.run({
        commandId: options.commandId,
        input,
        source: "cli",
        recordHistory: requireBooleanPreferenceValue(
          historyPreference.value,
          "command.history.enabled",
        ),
      });
    },
    {
      commandInputCoercion: "cli",
    },
  );
}

function requireBooleanPreferenceValue(value: unknown, key: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error(`CLI preference ${key} must be a boolean.`);
}

function formatListedCommand(command: ApplicationCommand): ListedCliCommand {
  const description = command.definition.description
    ? resolveLocalizedString(command.definition.description)
    : undefined;

  return {
    id: command.id,
    pluginId: command.pluginId,
    title: resolveLocalizedString(command.definition.title),
    ...(description ? { description } : {}),
  };
}

function resolveLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}

function resolveDefaultStoragePath(options: ListCliCommandsOptions): string {
  const firstPluginSource = options.pluginSources?.[0]?.path ?? options.pluginsRoot;

  if (!firstPluginSource) {
    throw new Error("Missing plugin scan sources.");
  }

  return path.join(path.dirname(firstPluginSource), ".data", "tooldeck.sqlite");
}
