import type { JsonObject, JsonValue } from "@tooldeck/protocol";

import type { JsonSchemaDocument } from "../contracts";
import { appendJsonPointer, isJsonObject } from "./json";

const singleSchemaKeywords = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "else",
  "if",
  "not",
  "propertyNames",
  "then",
] as const;

const schemaArrayKeywords = ["allOf", "anyOf", "oneOf"] as const;
const schemaMapKeywords = ["definitions", "patternProperties", "properties"] as const;

/** Walk every Draft-07 subschema without treating annotation or example values as schemas. */
export function walkJsonSchema(
  schema: JsonSchemaDocument,
  visit: (schema: JsonObject, pointer: string) => void,
): void {
  walk(schema, "", visit);
}

function walk(
  schema: JsonSchemaDocument,
  pointer: string,
  visit: (schema: JsonObject, pointer: string) => void,
): void {
  if (typeof schema === "boolean") {
    return;
  }

  visit(schema, pointer);

  for (const keyword of singleSchemaKeywords) {
    walkChild(schema[keyword], appendJsonPointer(pointer, keyword), visit);
  }

  const items = schema.items;

  if (Array.isArray(items)) {
    items.forEach((item, index) =>
      walkChild(item, appendJsonPointer(appendJsonPointer(pointer, "items"), String(index)), visit),
    );
  } else {
    walkChild(items, appendJsonPointer(pointer, "items"), visit);
  }

  for (const keyword of schemaArrayKeywords) {
    const children = schema[keyword];

    if (!Array.isArray(children)) {
      continue;
    }

    children.forEach((child, index) =>
      walkChild(
        child,
        appendJsonPointer(appendJsonPointer(pointer, keyword), String(index)),
        visit,
      ),
    );
  }

  for (const keyword of schemaMapKeywords) {
    walkSchemaMap(schema[keyword], appendJsonPointer(pointer, keyword), visit);
  }

  walkSchemaMap(schema.dependencies, appendJsonPointer(pointer, "dependencies"), visit);
}

function walkSchemaMap(
  value: JsonValue | undefined,
  pointer: string,
  visit: (schema: JsonObject, pointer: string) => void,
): void {
  if (value === undefined || !isJsonObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    walkChild(child, appendJsonPointer(pointer, key), visit);
  }
}

function walkChild(
  value: JsonValue | undefined,
  pointer: string,
  visit: (schema: JsonObject, pointer: string) => void,
): void {
  if (value !== undefined && (typeof value === "boolean" || isJsonObject(value))) {
    walk(value, pointer, visit);
  }
}
