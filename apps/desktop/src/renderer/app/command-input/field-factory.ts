import type { JsonValue } from "@tooldeck/shared";

import type {
  InputArrayItemType,
  InputField,
  InputFieldKind,
  InputFieldOption,
  InputSchemaType,
} from "./types";

interface CreateInputFieldOptions {
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
}

export function createInputField(options: CreateInputFieldOptions): InputField {
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
    return { ...base, kind, schemaType: "boolean" };
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
    return { ...base, kind, placeholder: options.placeholder, rows: options.rows };
  }

  return { ...base, kind, placeholder: options.placeholder };
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
    return control === "checkboxGroup" || control === "multiSelect"
      ? control
      : options.length <= 6
        ? "checkboxGroup"
        : "multiSelect";
  }

  if (type === "string") {
    if (options?.length) {
      return control === "radio" || control === "select"
        ? control
        : options.length <= 4
          ? "radio"
          : "select";
    }

    return control === "text" || control === "textarea" ? control : "textarea";
  }

  return "text";
}
