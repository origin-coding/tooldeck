import type { JsonPrimitive } from "@tooldeck/shared";

import { getSchemaType, isJsonPrimitive, isRecord } from "./schema-values";
import type { InputFieldOption } from "./types";

export function getFieldOptions(
  fieldSchema: Record<string, unknown>,
): InputFieldOption[] | undefined {
  const enumValues =
    Array.isArray(fieldSchema.enum) && fieldSchema.enum.every(isJsonPrimitive)
      ? fieldSchema.enum
      : getArrayEnumValues(fieldSchema);

  if (!enumValues?.length) {
    return undefined;
  }

  const enumLabels = getEnumLabels(fieldSchema);

  return enumValues.map((value) => ({
    label: enumLabels.get(formatEnumLabelKey(value)) ?? formatOptionLabel(value),
    value,
  }));
}

function getArrayEnumValues(fieldSchema: Record<string, unknown>): JsonPrimitive[] | undefined {
  if (getSchemaType(fieldSchema) !== "array" || !isRecord(fieldSchema.items)) {
    return undefined;
  }

  const enumValues = fieldSchema.items.enum;

  return Array.isArray(enumValues) && enumValues.every(isJsonPrimitive) ? enumValues : undefined;
}

function getEnumLabels(fieldSchema: Record<string, unknown>): Map<string, string> {
  const labels = fieldSchema["x-enumLabels"];

  if (!isRecord(labels)) {
    return new Map();
  }

  return new Map(
    Object.entries(labels).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function formatOptionLabel(value: JsonPrimitive): string {
  return value === null ? "null" : String(value);
}

function formatEnumLabelKey(value: JsonPrimitive): string {
  return value === null ? "null" : String(value);
}
