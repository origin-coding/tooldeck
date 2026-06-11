import { readFileSync } from "node:fs";
import path from "node:path";

import {
  flattenLocaleResource,
  type IndexedCommand,
  type IndexedPlugin,
  type LocaleResourceIndex,
  PluginManager,
  resolveJsonSchemaI18n,
  resolveLocalizedString,
} from "@tooldeck/core";
import type { LocalizedString, TooldeckJsonSchema } from "@tooldeck/protocol";
import { validatePreferenceValue, type PreferenceDefinition } from "@tooldeck/shared";
import type { PluginRow, PreferenceRow } from "@tooldeck/storage";

import type { DesktopCommand, DesktopPreference, DesktopPlugin } from "@/shared/desktop-api";

export function formatDesktopCommand(options: {
  command: IndexedCommand;
  indexedPlugin: IndexedPlugin | undefined;
  plugin: PluginRow | undefined;
  pluginManager: PluginManager;
  locale?: string;
}): DesktopCommand {
  const { command, indexedPlugin, plugin, pluginManager, locale } = options;
  const localeResources = readManifestLocaleResources(indexedPlugin);
  const defaultLocale = indexedPlugin?.manifest.defaultLocale;
  const title = resolveLocalizedString({
    value: command.definition.title,
    resources: localeResources,
    locale,
    defaultLocale,
  });
  const description = command.definition.description
    ? resolveLocalizedString({
        value: command.definition.description,
        resources: localeResources,
        locale,
        defaultLocale,
      })
    : undefined;

  return {
    id: command.id,
    pluginId: command.pluginId,
    pluginEnabled: plugin?.enabled ?? false,
    pluginRuntimeState: pluginManager.getPluginRuntimeState(command.pluginId),
    title,
    description,
    ...(command.definition["x-ui"] ? { "x-ui": command.definition["x-ui"] } : {}),
    inputSchema: command.definition.inputSchema
      ? (resolveJsonSchemaI18n({
          schema: command.definition.inputSchema,
          resources: localeResources,
          locale,
          defaultLocale,
        }) as TooldeckJsonSchema)
      : undefined,
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
  locale?: string;
}): DesktopPlugin {
  const { plugin, indexedPlugin, commandCount, pluginManager, locale } = options;
  const localeResources = readManifestLocaleResources(indexedPlugin);
  const defaultLocale = indexedPlugin?.manifest.defaultLocale;
  const name = resolveStoredLocalizedString(plugin.nameJson, {
    resources: localeResources,
    locale,
    defaultLocale,
  });
  const description = indexedPlugin?.manifest.description
    ? resolveLocalizedString({
        value: indexedPlugin.manifest.description,
        resources: localeResources,
        locale,
        defaultLocale,
      })
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

function resolveStoredLocalizedString(
  value: string,
  options: {
    resources: LocaleResourceIndex;
    locale?: string;
    defaultLocale?: string;
  },
): string {
  try {
    return resolveLocalizedString({
      value: JSON.parse(value) as LocalizedString,
      ...options,
    });
  } catch {
    return value;
  }
}

function readManifestLocaleResources(
  indexedPlugin: IndexedPlugin | undefined,
): LocaleResourceIndex {
  if (!indexedPlugin?.manifest.locales) {
    return {};
  }

  const manifestDir = path.dirname(indexedPlugin.manifestPath);
  const resources: LocaleResourceIndex = {};

  for (const [locale, localePath] of Object.entries(indexedPlugin.manifest.locales)) {
    if (!localePath) {
      continue;
    }

    try {
      const text = readFileSync(path.resolve(manifestDir, localePath), "utf8");
      resources[locale] = flattenLocaleResource(JSON.parse(text));
    } catch {
      // Locale files are optional search enrichment; manifest defaults remain searchable.
    }
  }

  return resources;
}

function collectPluginLocalizedSearchText(
  manifest: IndexedPlugin["manifest"],
  resources: LocaleResourceIndex,
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
  resources: LocaleResourceIndex,
): string[] {
  if (typeof value === "string") {
    return [value];
  }

  return uniqueStrings([
    value.default,
    ...Object.values(resources)
      .map((resource) => resource?.[value.key])
      .filter(isSearchString),
  ]);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(isSearchString))];
}

function isSearchString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
