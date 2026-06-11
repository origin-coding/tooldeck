import type { LocaleCode, LocalizedString } from "@tooldeck/protocol";

export type FlatLocaleResource = Record<string, string>;

export type LocaleResourceIndex = Partial<Record<LocaleCode, FlatLocaleResource>>;

export interface ResolveLocalizedStringOptions {
  value: LocalizedString;
  resources?: LocaleResourceIndex;
  locale?: LocaleCode;
  defaultLocale?: LocaleCode;
}

export function resolveLocalizedString({
  value,
  resources = {},
  locale,
  defaultLocale,
}: ResolveLocalizedStringOptions): string {
  if (typeof value === "string") {
    return value;
  }

  for (const candidate of createLocaleFallbacks(locale, defaultLocale)) {
    const translated = resources[candidate]?.[value.key];

    if (isNonEmptyString(translated)) {
      return translated;
    }
  }

  return value.default;
}

export function createLocaleFallbacks(
  locale: LocaleCode | undefined,
  defaultLocale: LocaleCode | undefined,
): LocaleCode[] {
  const candidates: LocaleCode[] = [];

  appendLocaleFallback(candidates, locale);
  appendLocaleFallback(candidates, defaultLocale);

  return candidates;
}

export function flattenLocaleResource(value: unknown, prefix = ""): FlatLocaleResource {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const flattened: FlatLocaleResource = {};

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

function appendLocaleFallback(candidates: LocaleCode[], locale: LocaleCode | undefined): void {
  if (!isNonEmptyString(locale)) {
    return;
  }

  appendUnique(candidates, locale);

  const language = locale.split("-")[0];

  if (language && language !== locale) {
    appendUnique(candidates, language);
  }
}

function appendUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
