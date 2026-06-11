import type { LocalizedString, TooldeckInputJsonSchema } from "@tooldeck/protocol";
import type { JsonPrimitive, JsonValue } from "@tooldeck/shared";

import type { DesktopCommand } from "@/shared/desktop-api";

import type {
  InputArrayItemType,
  InputField,
  InputFieldKind,
  InputFieldOption,
  InputSchemaType,
} from "./types";

export function getInputFields(command: DesktopCommand | undefined): InputField[] {
  const schema = command?.inputSchema;

  if (!isObjectSchema(schema)) {
    return [];
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  const properties = isRecord(schema.properties) ? schema.properties : {};

  const fieldOrder = getFieldOrder(schema, properties);

  return Object.entries(properties)
    .sort(sortFields(fieldOrder))
    .map(([key, value]) => {
      const fieldSchema = isRecord(value) ? value : {};
      const type = getSchemaType(fieldSchema);
      const ui = readFieldUi(fieldSchema);
      const title = typeof fieldSchema.title === "string" ? fieldSchema.title : key;
      const description =
        typeof fieldSchema.description === "string" ? fieldSchema.description : undefined;
      const options = getFieldOptions(fieldSchema);
      const itemType = getArrayItemType(fieldSchema);

      return createInputField({
        key,
        title,
        description,
        required: required.includes(key),
        defaultValue: isJsonValue(fieldSchema.default) ? fieldSchema.default : undefined,
        minimum: typeof fieldSchema.minimum === "number" ? fieldSchema.minimum : undefined,
        maximum: typeof fieldSchema.maximum === "number" ? fieldSchema.maximum : undefined,
        placeholder: ui?.placeholder ? resolveLocalizedString(ui.placeholder) : undefined,
        rows: typeof ui?.rows === "number" && ui.rows > 0 ? ui.rows : undefined,
        options,
        itemType,
        schemaType: type,
        control: ui?.control,
      });
    });
}

function createInputField(options: {
  key: string;
  title: string;
  description?: string;
  required: boolean;
  defaultValue?: JsonValue;
  minimum?: number;
  maximum?: number;
  placeholder?: string;
  rows?: number;
  options?: InputFieldOption[];
  itemType?: InputArrayItemType;
  schemaType?: InputSchemaType;
  control?: InputFieldKind;
}): InputField {
  const kind = getFieldKind(options.schemaType, options.control, options.options);
  const base = {
    key: options.key,
    title: options.title,
    description: options.description,
    required: options.required,
    defaultValue: options.defaultValue,
    itemType: options.itemType,
    schemaType: options.schemaType,
  };

  if (kind === "number") {
    return {
      ...base,
      kind,
      minimum: options.minimum,
      maximum: options.maximum,
      placeholder: options.placeholder,
    };
  }

  if (kind === "checkbox") {
    return {
      ...base,
      kind,
      schemaType: "boolean",
    };
  }

  if (kind === "radio" || kind === "select") {
    return {
      ...base,
      kind,
      options: options.options ?? [],
      placeholder: options.placeholder,
      schemaType: "string",
    };
  }

  if (kind === "checkboxGroup" || kind === "multiSelect") {
    return {
      ...base,
      kind,
      options: options.options ?? [],
      placeholder: options.placeholder,
      schemaType: "array",
    };
  }

  if (kind === "textarea") {
    return {
      ...base,
      kind,
      placeholder: options.placeholder,
      rows: options.rows,
    };
  }

  return {
    ...base,
    kind,
    placeholder: options.placeholder,
  };
}

function getFieldKind(
  type: InputSchemaType | undefined,
  control: InputFieldKind | undefined,
  options: InputFieldOption[] | undefined,
): InputFieldKind {
  if (type === "integer" || type === "number") {
    return "number";
  }

  if (type === "boolean") {
    return "checkbox";
  }

  if (type === "array" && options?.length) {
    if (control === "checkboxGroup" || control === "multiSelect") {
      return control;
    }

    return options.length <= 6 ? "checkboxGroup" : "multiSelect";
  }

  if (type === "string") {
    if (options?.length) {
      if (control === "radio" || control === "select") {
        return control;
      }

      return options.length <= 4 ? "radio" : "select";
    }

    return control === "text" || control === "textarea" ? control : "textarea";
  }

  return "text";
}

function readFieldUi(fieldSchema: Record<string, unknown>):
  | {
      control?: InputField["kind"];
      placeholder?: LocalizedString;
      rows?: number;
    }
  | undefined {
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

function getFieldOrder(
  schema: TooldeckInputJsonSchema,
  properties: Record<string, unknown>,
): Map<string, number> {
  const fieldOrder = schema["x-ui"]?.fieldOrder;

  if (!Array.isArray(fieldOrder)) {
    return new Map();
  }

  const propertyKeys = new Set(Object.keys(properties));
  const orderedFields = fieldOrder.filter((field) => propertyKeys.has(field));

  return new Map(orderedFields.map((field, index) => [field, index]));
}

function sortFields(fieldOrder: Map<string, number>) {
  return ([leftKey]: [string, unknown], [rightKey]: [string, unknown]): number => {
    const leftOrder = fieldOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = fieldOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER;

    return leftOrder - rightOrder;
  };
}

function isObjectSchema(
  schema: TooldeckInputJsonSchema | undefined,
): schema is TooldeckInputJsonSchema & {
  properties?: unknown;
  required?: unknown;
} {
  return isRecord(schema) && schema.type === "object";
}

function getSchemaType(fieldSchema: Record<string, unknown>): InputSchemaType | undefined {
  const type = Array.isArray(fieldSchema.type) ? fieldSchema.type[0] : fieldSchema.type;

  return type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean" ||
    type === "array"
    ? type
    : undefined;
}

function getArrayItemType(fieldSchema: Record<string, unknown>): InputArrayItemType | undefined {
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

function getFieldOptions(fieldSchema: Record<string, unknown>): InputFieldOption[] | undefined {
  const enumValues =
    Array.isArray(fieldSchema.enum) && fieldSchema.enum.every(isJsonPrimitive)
      ? fieldSchema.enum
      : getArrayEnumValues(fieldSchema);
  const enumLabels = getEnumLabels(fieldSchema);

  if (!enumValues?.length) {
    return undefined;
  }

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

function formatOptionLabel(value: JsonPrimitive): string {
  return value === null ? "null" : String(value);
}

function formatEnumLabelKey(value: JsonPrimitive): string {
  return value === null ? "null" : String(value);
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

function isJsonValue(value: unknown): value is JsonValue {
  if (isJsonPrimitive(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLocalizedString(value: unknown): value is LocalizedString {
  if (typeof value === "string") {
    return true;
  }

  return isRecord(value) && typeof value.key === "string" && typeof value.default === "string";
}

function resolveLocalizedString(value: LocalizedString): string {
  return typeof value === "string" ? value : value.default;
}
