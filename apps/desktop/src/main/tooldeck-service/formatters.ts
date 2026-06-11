import { readFileSync } from "node:fs";
import path from "node:path";

import { type IndexedCommand, type IndexedPlugin, PluginManager } from "@tooldeck/core";
import type { LocalizedString } from "@tooldeck/protocol";
import { validatePreferenceValue, type PreferenceDefinition } from "@tooldeck/shared";
import type { PluginRow, PreferenceRow } from "@tooldeck/storage";

import type { DesktopCommand, DesktopPreference, DesktopPlugin } from "@/shared/desktop-api";

export function formatDesktopCommand(options: {
  command: IndexedCommand;
  indexedPlugin: IndexedPlugin | undefined;
  plugin: PluginRow | undefined;
  pluginManager: PluginManager;
}): DesktopCommand {
  const { command, indexedPlugin, plugin, pluginManager } = options;
  const localeResources = readManifestLocaleResources(indexedPlugin);
  const title = resolveLocalizedString(command.definition.title);
  const description = command.definition.description
    ? resolveLocalizedString(command.definition.description)
    : undefined;

  return {
    id: command.id,
    pluginId: command.pluginId,
    pluginEnabled: plugin?.enabled ?? false,
    pluginRuntimeState: pluginManager.getPluginRuntimeState(command.pluginId),
    title,
    description,
    inputSchema: command.definition.inputSchema,
    searchText: uniqueStrings([
      command.id,
      command.pluginId,
      title,
      description,
      ...collectLocalizedStringSearchText(command.definition.title, localeResources),
      ...(command.definition.description
        ? collectLocalizedStringSearchText(command.definition.description, localeResources)
        : []),
      ...(indexedPlugin
        ? collectPluginLocalizedSearchText(indexedPlugin.manifest, localeResources)
        : []),
    ]),
  };
}

export function formatDesktopPlugin(options: {
  plugin: PluginRow;
  indexedPlugin: IndexedPlugin | undefined;
  commandCount: number;
  pluginManager: PluginManager;
}): DesktopPlugin {
  const { plugin, indexedPlugin, commandCount, pluginManager } = options;
  const localeResources = readManifestLocaleResources(indexedPlugin);
  const name = resolveStoredLocalizedString(plugin.nameJson);
  const description = indexedPlugin?.manifest.description
    ? resolveLocalizedString(indexedPlugin.manifest.description)
    : undefined;

  return {
    id: plugin.id,
    name,
    description,
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    enabled: plugin.enabled,
    runtimeState: indexedPlugin ? pluginManager.getPluginRuntimeState(plugin.id) : "inactive",
    commandCount,
    updatedAt: plugin.updatedAt,
    searchText: uniqueStrings([
      plugin.id,
      name,
      description,
      plugin.version,
      plugin.manifestPath,
      ...(indexedPlugin
        ? collectPluginLocalizedSearchText(indexedPlugin.manifest, localeResources)
        : []),
    ]),
  };
}

export function formatDesktopPreference(
  definition: PreferenceDefinition,
  preference: PreferenceRow | undefined,
): DesktopPreference {
  return {
    scope: definition.scope,
    key: definition.key,
    value: preference
      ? validatePreferenceValue(definition.scope, definition.key, JSON.parse(preference.valueJson))
      : definition.defaultValue,
    defaultValue: definition.defaultValue,
    description: definition.description,
    valueType: definition.valueType,
    ...(definition.values ? { values: definition.values } : {}),
    ...(preference ? { updatedAt: preference.updatedAt } : {}),
  };
}

type LocaleResources = Record<string, string>[];

function resolveLocalizedString(value: LocalizedString): string {
  if (typeof value === "string") {
    return value;
  }

  return value.default;
}

function resolveStoredLocalizedString(value: string): string {
  try {
    return resolveLocalizedString(JSON.parse(value) as LocalizedString);
  } catch {
    return value;
  }
}

function readManifestLocaleResources(indexedPlugin: IndexedPlugin | undefined): LocaleResources {
  if (!indexedPlugin?.manifest.locales) {
    return [];
  }

  const manifestDir = path.dirname(indexedPlugin.manifestPath);
  const resources: LocaleResources = [];

  for (const localePath of Object.values(indexedPlugin.manifest.locales)) {
    if (!localePath) {
      continue;
    }

    try {
      const text = readFileSync(path.resolve(manifestDir, localePath), "utf8");
      resources.push(flattenLocaleResource(JSON.parse(text)));
    } catch {
      // Locale files are optional search enrichment; manifest defaults remain searchable.
    }
  }

  return resources;
}

function flattenLocaleResource(value: unknown, prefix = ""): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const flattened: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof entry === "string") {
      flattened[nextKey] = entry;
      continue;
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      Object.assign(flattened, flattenLocaleResource(entry, nextKey));
    }
  }

  return flattened;
}

function collectPluginLocalizedSearchText(
  manifest: IndexedPlugin["manifest"],
  resources: LocaleResources,
): string[] {
  return [
    manifest.id,
    manifest.version,
    ...collectLocalizedStringSearchText(manifest.name, resources),
    ...(manifest.description
      ? collectLocalizedStringSearchText(manifest.description, resources)
      : []),
  ];
}

function collectLocalizedStringSearchText(
  value: LocalizedString,
  resources: LocaleResources,
): string[] {
  if (typeof value === "string") {
    return [value];
  }

  return uniqueStrings([
    value.default,
    ...resources.map((resource) => resource[value.key]).filter(isSearchString),
  ]);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(isSearchString))];
}

function isSearchString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
