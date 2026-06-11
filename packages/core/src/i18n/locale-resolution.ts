import type { LocaleCode, LocalizedString } from "@tooldeck/protocol";

type JsonSchemaDefinition = boolean | JsonSchemaObject;

interface JsonSchemaObject {
  [key: string]: unknown;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaDefinition>;
  items?: JsonSchemaDefinition | JsonSchemaDefinition[];
  additionalProperties?: boolean | JsonSchemaDefinition;
  allOf?: JsonSchemaDefinition[];
  anyOf?: JsonSchemaDefinition[];
  oneOf?: JsonSchemaDefinition[];
  not?: JsonSchemaDefinition;
  definitions?: Record<string, JsonSchemaDefinition>;
}

export type FlatLocaleResource = Record<string, string>;

export type LocaleResourceIndex = Partial<Record<LocaleCode, FlatLocaleResource>>;

export interface ResolveLocalizedStringOptions {
  value: LocalizedString;
  resources?: LocaleResourceIndex;
  locale?: LocaleCode;
  defaultLocale?: LocaleCode;
}

export interface ResolveJsonSchemaI18nOptions {
  schema: unknown;
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

export function resolveJsonSchemaI18n({
  schema,
  resources = {},
  locale,
  defaultLocale,
}: ResolveJsonSchemaI18nOptions): unknown {
  return resolveSchemaDefinitionI18n(
    isSchemaObject(schema) ? schema : {},
    resources,
    locale,
    defaultLocale,
  );
}

function resolveSchemaDefinitionI18n(
  schema: JsonSchemaDefinition,
  resources: LocaleResourceIndex,
  locale: LocaleCode | undefined,
  defaultLocale: LocaleCode | undefined,
): JsonSchemaDefinition {
  if (typeof schema === "boolean") {
    return schema;
  }

  const resolved: JsonSchemaObject = { ...schema };
  const i18n = readSchemaI18n(schema);

  if (i18n?.title) {
    resolved.title = resolveTranslationKey({
      key: i18n.title,
      fallback: schema.title,
      resources,
      locale,
      defaultLocale,
    });
  }

  if (i18n?.description) {
    resolved.description = resolveTranslationKey({
      key: i18n.description,
      fallback: schema.description,
      resources,
      locale,
      defaultLocale,
    });
  }

  if (schema.properties) {
    resolved.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        resolveSchemaDefinitionI18n(value, resources, locale, defaultLocale),
      ]),
    );
  }

  if (schema.items) {
    resolved.items = Array.isArray(schema.items)
      ? schema.items.map((item) =>
          resolveSchemaDefinitionI18n(item, resources, locale, defaultLocale),
        )
      : resolveSchemaDefinitionI18n(schema.items, resources, locale, defaultLocale);
  }

  if (schema.additionalProperties && typeof schema.additionalProperties !== "boolean") {
    resolved.additionalProperties = resolveSchemaDefinitionI18n(
      schema.additionalProperties,
      resources,
      locale,
      defaultLocale,
    );
  }

  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (schema[key]) {
      resolved[key] = schema[key]?.map((entry) =>
        resolveSchemaDefinitionI18n(entry, resources, locale, defaultLocale),
      );
    }
  }

  if (schema.not) {
    resolved.not = resolveSchemaDefinitionI18n(schema.not, resources, locale, defaultLocale);
  }

  if (schema.definitions) {
    resolved.definitions = Object.fromEntries(
      Object.entries(schema.definitions).map(([key, value]) => [
        key,
        resolveSchemaDefinitionI18n(value, resources, locale, defaultLocale),
      ]),
    );
  }

  return resolved;
}

function resolveTranslationKey({
  key,
  fallback,
  resources,
  locale,
  defaultLocale,
}: {
  key: string;
  fallback: string | undefined;
  resources: LocaleResourceIndex;
  locale: LocaleCode | undefined;
  defaultLocale: LocaleCode | undefined;
}): string | undefined {
  for (const candidate of createLocaleFallbacks(locale, defaultLocale)) {
    const translated = resources[candidate]?.[key];

    if (isNonEmptyString(translated)) {
      return translated;
    }
  }

  return fallback;
}

function readSchemaI18n(
  schema: JsonSchemaObject,
): { title?: string; description?: string } | undefined {
  const value = (schema as { "x-i18n"?: unknown })["x-i18n"];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const i18n = value as { title?: unknown; description?: unknown };

  return {
    ...(typeof i18n.title === "string" ? { title: i18n.title } : {}),
    ...(typeof i18n.description === "string" ? { description: i18n.description } : {}),
  };
}

function isSchemaObject(value: unknown): value is JsonSchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
