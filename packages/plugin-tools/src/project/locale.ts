import path from "node:path";

import type { LocalizedString, PluginManifest } from "@tooldeck/protocol";

import type { LocaleInspection, PluginProjectDiagnostic } from "./types";
import { isRecord, readJsonIfExists } from "./utils";

export async function checkLocales(
  manifest: PluginManifest,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const keys = collectManifestLocalizationKeys(manifest);

  if (keys.size === 0) {
    return;
  }

  if (!manifest.locales || Object.keys(manifest.locales).length === 0) {
    diagnostics.push({
      severity: "error",
      code: "LOCALES_MISSING",
      message: "Manifest uses localization keys but does not declare locale files.",
      fieldPath: "locales",
      suggestion:
        'Add a locales map to manifest.json, for example "locales": { "en": "./locales/en.json" }.',
    });

    return;
  }

  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!localePath) {
      diagnostics.push({
        severity: "error",
        code: "LOCALE_FILE_MISSING",
        message: `Locale ${locale} does not declare a locale file path.`,
        fieldPath: `locales.${locale}`,
        suggestion: `Set manifest.locales.${locale} to a relative locale JSON file path.`,
      });
      continue;
    }

    const resolvedPath = path.resolve(manifestDir, localePath);
    const resource = await readJsonIfExists(resolvedPath);

    if (!resource) {
      diagnostics.push({
        severity: "error",
        code: "LOCALE_FILE_MISSING",
        message: `Locale file for ${locale} is missing or invalid JSON.`,
        path: resolvedPath,
        fieldPath: `locales.${locale}`,
        suggestion: `Create ${localePath} with string values for the manifest localization keys.`,
      });
      continue;
    }

    for (const key of keys) {
      if (typeof resource[key] !== "string") {
        diagnostics.push({
          severity: "error",
          code: "LOCALE_KEY_MISSING",
          message: `Locale ${locale} does not define key: ${key}`,
          path: resolvedPath,
          fieldPath: key,
          suggestion: `Add "${key}" to ${localePath} with a translated string value.`,
        });
      }
    }
  }
}

export async function inspectLocales(
  manifest: PluginManifest | undefined,
  manifestDir: string,
): Promise<LocaleInspection[]> {
  if (!manifest?.locales) {
    return [];
  }

  const keys = collectManifestLocalizationKeys(manifest);
  const locales: LocaleInspection[] = [];

  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!localePath) {
      locales.push({
        locale,
        path: path.resolve(manifestDir, "<missing-locale-path>"),
        exists: false,
        missingKeys: [...keys],
      });
      continue;
    }

    const resolvedPath = path.resolve(manifestDir, localePath);
    const resource = await readJsonIfExists(resolvedPath);
    const missingKeys = resource
      ? [...keys].filter((key) => typeof resource[key] !== "string")
      : [...keys];

    locales.push({
      locale,
      path: resolvedPath,
      exists: Boolean(resource),
      missingKeys,
    });
  }

  return locales;
}

export function renderLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}

function collectManifestLocalizationKeys(manifest: PluginManifest): Set<string> {
  const keys = new Set<string>();

  collectLocalizedStringKey(manifest.name, keys);
  collectLocalizedStringKey(manifest.description, keys);

  for (const command of manifest.contributes?.commands ?? []) {
    collectLocalizedStringKey(command.title, keys);
    collectLocalizedStringKey(command.description, keys);
    collectSchemaLocalizationKeys(command.inputSchema, keys);
    collectSchemaLocalizationKeys(command.outputSchema, keys);
  }

  return keys;
}

function collectSchemaLocalizationKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaLocalizationKeys(item, keys);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const i18n = value["x-i18n"];

  if (isRecord(i18n)) {
    for (const i18nValue of Object.values(i18n)) {
      if (typeof i18nValue === "string") {
        keys.add(i18nValue);
      } else if (isRecord(i18nValue)) {
        for (const nestedValue of Object.values(i18nValue)) {
          if (typeof nestedValue === "string") {
            keys.add(nestedValue);
          }
        }
      }
    }
  }

  const ui = value["x-ui"];

  if (isRecord(ui)) {
    collectLocalizedStringKey(ui.placeholder, keys);
  }

  for (const item of Object.values(value)) {
    collectSchemaLocalizationKeys(item, keys);
  }
}

function collectLocalizedStringKey(value: unknown, keys: Set<string>): void {
  if (isRecord(value) && typeof value.key === "string") {
    keys.add(value.key);
  }
}
