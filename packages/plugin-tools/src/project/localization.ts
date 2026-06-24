import type { LocalizedString, PluginManifest } from "@tooldeck/protocol";

import { isRecord } from "./json";

export function collectManifestLocalizationKeys(manifest: PluginManifest): Set<string> {
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

export function renderLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
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
