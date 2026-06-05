import type { TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject } from "@tooldeck/shared";

import type { DesktopCommand } from "@/shared/desktop-api";

export interface InputField {
  key: string;
  title: string;
  description?: string;
  kind: "text" | "textarea" | "number";
  required: boolean;
  defaultValue?: unknown;
  minimum?: number;
  maximum?: number;
}

export function getInputFields(command: DesktopCommand | undefined): InputField[] {
  const schema = command?.inputSchema;

  if (!isObjectSchema(schema)) {
    return [];
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  return Object.entries(properties).map(([key, value]) => {
    const fieldSchema = isRecord(value) ? value : {};
    const type = typeof fieldSchema.type === "string" ? fieldSchema.type : "string";
    const title = typeof fieldSchema.title === "string" ? fieldSchema.title : key;
    const description =
      typeof fieldSchema.description === "string" ? fieldSchema.description : undefined;

    return {
      key,
      title,
      description,
      kind:
        type === "integer" || type === "number"
          ? "number"
          : type === "string"
            ? "textarea"
            : "text",
      required: required.includes(key),
      defaultValue: fieldSchema.default,
      minimum: typeof fieldSchema.minimum === "number" ? fieldSchema.minimum : undefined,
      maximum: typeof fieldSchema.maximum === "number" ? fieldSchema.maximum : undefined,
    };
  });
}

export function createInputState(
  command: DesktopCommand | undefined,
  currentInput: Record<string, string>,
): Record<string, string> {
  const fields = getInputFields(command);

  return Object.fromEntries(
    fields.map((field) => [field.key, currentInput[field.key] ?? defaultInputValue(field)]),
  );
}

export function buildCommandInput(
  command: DesktopCommand,
  input: Record<string, string>,
): JsonObject {
  const fields = getInputFields(command);
  const entries = fields.map<[string, unknown]>((field) => {
    const value = input[field.key] ?? "";

    if (field.kind === "number") {
      return [field.key, Number(value)];
    }

    return [field.key, value];
  });

  return Object.fromEntries(entries) as JsonObject;
}

function defaultInputValue(field: InputField): string {
  if (field.defaultValue !== undefined) {
    return String(field.defaultValue);
  }

  if (field.key === "text") {
    return '{"a":1}';
  }

  return "";
}

function isObjectSchema(schema: TooldeckJsonSchema | undefined): schema is TooldeckJsonSchema & {
  properties?: unknown;
  required?: unknown;
} {
  return isRecord(schema) && schema.type === "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
