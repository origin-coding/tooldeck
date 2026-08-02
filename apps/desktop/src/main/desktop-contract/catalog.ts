import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  ApplicationCommand,
  ApplicationPlugin,
  ApplicationPreference,
} from "@tooldeck/application-node";
import type { LocalizedString, TooldeckInputJsonSchema } from "@tooldeck/protocol";

import type { DesktopCommand, DesktopPlugin, DesktopPreference } from "@/shared/api";

export function toDesktopCommand(
  command: ApplicationCommand,
  plugin: ApplicationPlugin | undefined,
): DesktopCommand {
  const title = resolveLocalizedDefault(command.definition.title);
  const description = command.definition.description
    ? resolveLocalizedDefault(command.definition.description)
    : undefined;
  const resources = plugin ? readManifestLocaleResources(plugin) : {};
  const declaredCommand = plugin?.manifest.contributes?.commands?.find(
    (candidate) => candidate.id === command.id,
  );

  return {
    id: command.id,
    pluginId: command.pluginId,
    pluginEnabled: command.pluginEnabled,
    pluginRuntimeState: command.pluginRuntimeState,
    title,
    ...(description ? { description } : {}),
    ...(command.definition["x-ui"] ? { "x-ui": command.definition["x-ui"] } : {}),
    ...(command.definition.inputSchema
      ? { inputSchema: command.definition.inputSchema as TooldeckInputJsonSchema }
      : {}),
    searchText: uniqueStrings([
      command.id,
      command.pluginId,
      title,
      description,
      ...(declaredCommand
        ? collectLocalizedString(declaredCommand.title, resources)
        : collectLocalizedString(command.definition.title, resources)),
      ...(declaredCommand?.description
        ? collectLocalizedString(declaredCommand.description, resources)
        : command.definition.description
          ? collectLocalizedString(command.definition.description, resources)
          : []),
      ...(plugin ? collectPluginSearchText(plugin, resources) : []),
    ]),
  };
}

export function toDesktopPlugin(plugin: ApplicationPlugin): DesktopPlugin {
  const name = resolveLocalizedDefault(plugin.name);
  const description = plugin.description ? resolveLocalizedDefault(plugin.description) : undefined;
  const resources = readManifestLocaleResources(plugin);

  return {
    id: plugin.id,
    name,
    ...(description ? { description } : {}),
    version: plugin.version,
    manifestPath: plugin.manifestPath,
    sourceKind: plugin.sourceKind,
    enabled: plugin.enabled,
    runtimeState: plugin.runtimeState,
    commandCount: plugin.commandCount,
    updatedAt: plugin.updatedAt,
    searchText: uniqueStrings([
      plugin.id,
      name,
      description,
      plugin.version,
      plugin.manifestPath,
      ...collectPluginSearchText(plugin, resources),
    ]),
  };
}

export function toDesktopPreference(preference: ApplicationPreference): DesktopPreference {
  if (preference.scope !== "shared" && preference.scope !== "desktop") {
    throw new Error(`Desktop cannot expose preference scope: ${preference.scope}`);
  }

  return {
    scope: preference.scope,
    key: preference.key,
    value: preference.value,
    defaultValue: preference.defaultValue,
    description: preference.description,
    valueType: preference.valueType,
    ...(preference.values ? { values: preference.values } : {}),
    ...(preference.updatedAt === undefined ? {} : { updatedAt: preference.updatedAt }),
  };
}

type LocaleResourceIndex = Record<string, Record<string, string>>;

function collectPluginSearchText(
  plugin: ApplicationPlugin,
  resources: LocaleResourceIndex,
): string[] {
  return uniqueStrings([
    ...collectLocalizedString(plugin.manifest.name, resources),
    ...(plugin.manifest.description
      ? collectLocalizedString(plugin.manifest.description, resources)
      : []),
  ]);
}

function readManifestLocaleResources(plugin: ApplicationPlugin): LocaleResourceIndex {
  if (!plugin.manifest.locales) {
    return {};
  }

  const manifestDir = path.dirname(plugin.manifestPath);
  const resources: LocaleResourceIndex = {};

  for (const [locale, localePath] of Object.entries(plugin.manifest.locales)) {
    if (!localePath) {
      continue;
    }

    try {
      resources[locale] = flattenLocaleResource(
        JSON.parse(readFileSync(path.resolve(manifestDir, localePath), "utf8")),
      );
    } catch {
      // Locale resources are optional search enrichment.
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
    } else if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      Object.assign(flattened, flattenLocaleResource(entry, nextKey));
    }
  }

  return flattened;
}

function collectLocalizedString(value: LocalizedString, resources: LocaleResourceIndex): string[] {
  return typeof value === "string"
    ? [value]
    : [
        value.default,
        ...Object.values(resources)
          .map((resource) => resource[value.key])
          .filter(isSearchString),
      ];
}

function resolveLocalizedDefault(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(isSearchString))];
}

function isSearchString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}
