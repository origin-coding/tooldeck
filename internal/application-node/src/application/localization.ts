import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  CommandDefinition,
  CommandResult,
  ContentBlock,
  PropertiesContentBlock,
  PropertyItem,
} from "@tooldeck/protocol";
import {
  flattenLocaleResource,
  resolveJsonSchemaI18n,
  resolveLocalizedString,
  type IndexedPlugin,
  type LocaleResourceIndex,
} from "@tooldeck/runtime-node";

import type { ApplicationCommand } from "@/commands/types";
import type { ApplicationPlugin } from "@/plugins/facade-types";

export function localizeApplicationCommand(
  command: ApplicationCommand,
  indexedPlugin: IndexedPlugin | undefined,
  locale: string | undefined,
): ApplicationCommand {
  if (!locale) {
    return command;
  }

  const resources = readManifestLocaleResources(indexedPlugin);
  const defaultLocale = indexedPlugin?.manifest.defaultLocale;
  const definition = command.definition;

  return {
    ...command,
    definition: {
      ...definition,
      title: resolveLocalizedString({
        value: definition.title,
        resources,
        locale,
        defaultLocale,
      }),
      ...(definition.description
        ? {
            description: resolveLocalizedString({
              value: definition.description,
              resources,
              locale,
              defaultLocale,
            }),
          }
        : {}),
      ...(definition.inputSchema
        ? {
            inputSchema: resolveJsonSchemaI18n({
              schema: definition.inputSchema,
              resources,
              locale,
              defaultLocale,
            }) as CommandDefinition["inputSchema"],
          }
        : {}),
    },
  };
}

export function localizeApplicationPlugin(
  plugin: ApplicationPlugin,
  indexedPlugin: IndexedPlugin | undefined,
  locale: string | undefined,
): ApplicationPlugin {
  if (!locale) {
    return plugin;
  }

  const resources = readManifestLocaleResources(indexedPlugin);
  const defaultLocale = indexedPlugin?.manifest.defaultLocale;

  return {
    ...plugin,
    name: resolveLocalizedString({
      value: plugin.name,
      resources,
      locale,
      defaultLocale,
    }),
    ...(plugin.description
      ? {
          description: resolveLocalizedString({
            value: plugin.description,
            resources,
            locale,
            defaultLocale,
          }),
        }
      : {}),
  };
}

export function localizeApplicationCommandResult(
  result: CommandResult,
  indexedPlugin: IndexedPlugin | undefined,
  locale: string | undefined,
): CommandResult {
  if (!locale) {
    return result;
  }

  const resources = readManifestLocaleResources(indexedPlugin);
  const defaultLocale = indexedPlugin?.manifest.defaultLocale;

  return {
    ...result,
    blocks: result.blocks.map((block) =>
      localizeContentBlock(block, resources, locale, defaultLocale),
    ),
  };
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
      resources[locale] = flattenLocaleResource(
        JSON.parse(readFileSync(path.resolve(manifestDir, localePath), "utf8")),
      );
    } catch {
      // Locale resources are optional; manifest defaults remain valid fallbacks.
    }
  }

  return resources;
}

function localizeContentBlock(
  block: ContentBlock,
  resources: LocaleResourceIndex,
  locale: string,
  defaultLocale: string | undefined,
): ContentBlock {
  if (block.type !== "properties") {
    return block;
  }

  return {
    ...block,
    items: block.items.map((item) => localizePropertyItem(item, resources, locale, defaultLocale)),
  } satisfies PropertiesContentBlock;
}

function localizePropertyItem(
  item: PropertyItem,
  resources: LocaleResourceIndex,
  locale: string,
  defaultLocale: string | undefined,
): PropertyItem {
  return {
    ...item,
    label: resolveLocalizedString({
      value: item.label,
      resources,
      locale,
      defaultLocale,
    }),
    ...(item.note
      ? {
          note: resolveLocalizedString({
            value: item.note,
            resources,
            locale,
            defaultLocale,
          }),
        }
      : {}),
  };
}
