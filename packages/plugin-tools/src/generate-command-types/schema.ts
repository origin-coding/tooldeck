type JsonObject = Record<string, unknown>;

const schemaAnnotationKeys = new Set([
  "title",
  "description",
  "default",
  "examples",
  "readOnly",
  "writeOnly",
  "deprecated",
  "x-i18n",
  "x-ui",
  "x-enumLabels",
]);

export function sanitizeSchemaForTypescript(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSchemaForTypescript(item));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const sanitized: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    if (schemaAnnotationKeys.has(key)) {
      continue;
    }

    sanitized[key] = sanitizeSchemaForTypescript(item);
  }

  return sanitized;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
