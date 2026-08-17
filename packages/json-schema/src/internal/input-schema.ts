import type { JsonObject, JsonValue, TooldeckInputJsonSchema } from "@tooldeck/protocol";

/** @internal */
export function normalizeCommandInputSchema(
  schema: TooldeckInputJsonSchema,
): TooldeckInputJsonSchema {
  return normalizeSchemaNode(schema as unknown as JsonObject) as unknown as TooldeckInputJsonSchema;
}

function normalizeSchemaNode(schema: JsonObject | boolean): JsonObject | boolean {
  if (typeof schema === "boolean") {
    return schema;
  }

  const normalized: JsonObject = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && isJsonObject(value)) {
      normalized[key] = Object.fromEntries(
        Object.entries(value).map(([propertyName, propertySchema]) => [
          propertyName,
          isSchemaDocument(propertySchema) ? normalizeSchemaNode(propertySchema) : propertySchema,
        ]),
      );
      continue;
    }

    if ((key === "items" || key === "additionalProperties") && isSchemaDocument(value)) {
      normalized[key] = normalizeSchemaNode(value);
      continue;
    }

    if (key === "allOf" && Array.isArray(value)) {
      normalized[key] = value.map((item) =>
        isSchemaDocument(item) ? normalizeSchemaNode(item) : item,
      );
      continue;
    }

    normalized[key] = value;
  }

  if (
    normalized.type === undefined &&
    (normalized.properties !== undefined ||
      normalized.required !== undefined ||
      normalized.additionalProperties !== undefined)
  ) {
    normalized.type = "object";
  }

  if (
    normalized.type === undefined &&
    (normalized.items !== undefined ||
      normalized.minItems !== undefined ||
      normalized.maxItems !== undefined ||
      normalized.uniqueItems !== undefined)
  ) {
    normalized.type = "array";
  }

  return normalized;
}

function isSchemaDocument(value: JsonValue): value is JsonObject | boolean {
  return typeof value === "boolean" || isJsonObject(value);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
