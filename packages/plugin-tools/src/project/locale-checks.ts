import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import { readJsonIfExists } from "./json";
import { collectManifestLocalizationKeys } from "./localization";
import type { LocaleInspection, PluginProjectDiagnostic } from "./types";

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
    });

    return;
  }

  for (const [locale, localePath] of Object.entries(manifest.locales)) {
    if (!localePath) {
      diagnostics.push({
        severity: "error",
        code: "LOCALE_FILE_MISSING",
        message: `Locale ${locale} does not declare a locale file path.`,
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
