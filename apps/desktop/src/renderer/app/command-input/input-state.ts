import type { JsonObject, JsonPrimitive, JsonValue } from "@tooldeck/shared";

import type { DesktopCommand } from "@/shared/desktop-api";

import { getInputFields } from "./schema-fields";
import type { CommandInputState, CommandInputValue, InputField } from "./types";

export function createInputState(
  command: DesktopCommand | undefined,
  currentInput: CommandInputState,
): CommandInputState {
  const fields = getInputFields(command);

  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      normalizeInputValue(field, currentInput[field.key] ?? defaultInputValue(field)),
    ]),
  );
}

export function buildCommandInput(command: DesktopCommand, input: CommandInputState): JsonObject {
  const fields = getInputFields(command);
  const entries = fields.map<[string, unknown]>((field) => {
    const value = normalizeInputValue(field, input[field.key] ?? defaultInputValue(field));

    if (field.kind === "number") {
      return [field.key, value === "" ? undefined : Number(value)];
    }

    if (field.kind === "checkbox") {
      return [field.key, Boolean(value)];
    }

    if (field.kind === "checkboxGroup" || field.kind === "multiSelect") {
      return [field.key, Array.isArray(value) ? value : []];
    }

    return [field.key, value];
  });

  return Object.fromEntries(entries.filter(([, value]) => value !== undefined)) as JsonObject;
}

function defaultInputValue(field: InputField): CommandInputValue {
  if (field.defaultValue !== undefined) {
    return coerceFieldValue(field, field.defaultValue);
  }

  if (field.kind === "checkbox") {
    return false;
  }

  if (field.kind === "checkboxGroup" || field.kind === "multiSelect") {
    return [];
  }

  if (field.key === "text") {
    return '{"a":1}';
  }

  return "";
}

function normalizeInputValue(field: InputField, value: CommandInputValue): CommandInputValue {
  return coerceFieldValue(field, value);
}

function coerceFieldValue(field: InputField, value: JsonValue | undefined): CommandInputValue {
  if (field.kind === "checkbox") {
    return value === true || value === "true";
  }

  if (field.kind === "checkboxGroup" || field.kind === "multiSelect") {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isJsonPrimitive);
  }

  if (field.kind === "number") {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const numberValue = Number(value);

      return Number.isFinite(numberValue) ? numberValue : "";
    }

    return "";
  }

  if (isJsonPrimitive(value) && value !== null) {
    return value;
  }

  return "";
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
