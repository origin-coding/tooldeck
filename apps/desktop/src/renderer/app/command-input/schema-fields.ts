import type { TooldeckInputJsonSchema } from "@tooldeck/protocol";

import type { DesktopCommand } from "@/shared/desktop-api";

import { createInputField } from "./field-factory";
import { getFieldOptions } from "./field-options";
import {
  getArrayItemType,
  getSchemaType,
  isJsonValue,
  isObjectSchema,
  isRecord,
  readFieldUi,
  resolveLocalizedString,
} from "./schema-values";
import type { InputField } from "./types";

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
      const ui = readFieldUi(fieldSchema);

      return createInputField({
        key,
        title: typeof fieldSchema.title === "string" ? fieldSchema.title : key,
        description:
          typeof fieldSchema.description === "string" ? fieldSchema.description : undefined,
        required: required.includes(key),
        defaultValue: isJsonValue(fieldSchema.default) ? fieldSchema.default : undefined,
        minimum: typeof fieldSchema.minimum === "number" ? fieldSchema.minimum : undefined,
        maximum: typeof fieldSchema.maximum === "number" ? fieldSchema.maximum : undefined,
        placeholder: ui?.placeholder ? resolveLocalizedString(ui.placeholder) : undefined,
        rows: typeof ui?.rows === "number" && ui.rows > 0 ? ui.rows : undefined,
        options: getFieldOptions(fieldSchema),
        itemType: getArrayItemType(fieldSchema),
        schemaType: getSchemaType(fieldSchema),
        control: ui?.control,
      });
    });
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
