import type { LocalizedString, TooldeckInputJsonSchema } from "@tooldeck/protocol";
import type { JsonPrimitive, JsonValue } from "@tooldeck/shared";

import type { InputArrayItemType, InputFieldKind, InputSchemaType } from "./types";

export function isObjectSchema(
  schema: TooldeckInputJsonSchema | undefined,
): schema is TooldeckInputJsonSchema & { properties?: unknown; required?: unknown } {
  return isRecord(schema) && schema.type === "object";
}

export function getSchemaType(fieldSchema: Record<string, unknown>): InputSchemaType | undefined {
  const type = Array.isArray(fieldSchema.type) ? fieldSchema.type[0] : fieldSchema.type;

  return type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "array"
    ? type
    : undefined;
}

export function getArrayItemType(
  fieldSchema: Record<string, unknown>,
): InputArrayItemType | undefined {
  const items = fieldSchema.items;

  if (!isRecord(items)) {
    return undefined;
  }

  const type = Array.isArray(items.type) ? items.type[0] : items.type;

  return type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "null"
    ? type
    : undefined;
}

export function readFieldUi(
  fieldSchema: Record<string, unknown>,
): { control?: InputFieldKind; placeholder?: LocalizedString; rows?: number } | undefined {
  const ui = fieldSchema["x-ui"];

  if (!isRecord(ui)) {
    return undefined;
  }

  return {
    control: isInputFieldKind(ui.control) ? ui.control : undefined,
    placeholder: isLocalizedString(ui.placeholder) ? ui.placeholder : undefined,
    rows: typeof ui.rows === "number" ? ui.rows : undefined,
  };
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (isJsonPrimitive(value)) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function resolveLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}

function isInputFieldKind(value: unknown): value is InputFieldKind {
  return (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "checkbox" ||
    value === "radio" ||
    value === "select" ||
    value === "checkboxGroup" ||
    value === "multiSelect"
  );
}

function isLocalizedString(value: unknown): value is LocalizedString {
  return (
    typeof value === "string" ||
    (isRecord(value) && typeof value.key === "string" && typeof value.default === "string")
  );
}
