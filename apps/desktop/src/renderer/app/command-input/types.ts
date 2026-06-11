import type { JsonPrimitive, JsonValue } from "@tooldeck/shared";

export type CommandInputValue = string | number | boolean | null | JsonPrimitive[];
export type CommandInputState = Record<string, CommandInputValue>;

export type InputField =
  | TextInputField
  | TextareaInputField
  | NumberInputField
  | CheckboxInputField
  | RadioInputField
  | SelectInputField
  | CheckboxGroupInputField
  | MultiSelectInputField;

interface BaseInputField {
  key: string;
  title: string;
  description?: string;
  required: boolean;
  defaultValue?: JsonValue;
  itemType?: "string" | "number" | "integer" | "boolean" | "null";
  schemaType?: "string" | "number" | "integer" | "boolean" | "array";
}

export interface TextInputField extends BaseInputField {
  kind: "text";
  placeholder?: string;
}

export interface TextareaInputField extends BaseInputField {
  kind: "textarea";
  placeholder?: string;
  rows?: number;
}

export interface NumberInputField extends BaseInputField {
  kind: "number";
  minimum?: number;
  maximum?: number;
  placeholder?: string;
}

export interface CheckboxInputField extends BaseInputField {
  kind: "checkbox";
  schemaType: "boolean";
}

interface BaseChoiceInputField extends BaseInputField {
  options: InputFieldOption[];
}

export interface RadioInputField extends BaseChoiceInputField {
  kind: "radio";
  placeholder?: string;
  schemaType: "string";
}

export interface SelectInputField extends BaseChoiceInputField {
  kind: "select";
  placeholder?: string;
  schemaType: "string";
}

export interface CheckboxGroupInputField extends BaseChoiceInputField {
  kind: "checkboxGroup";
  itemType?: "string" | "number" | "integer" | "boolean" | "null";
  placeholder?: string;
  schemaType: "array";
}

export interface MultiSelectInputField extends BaseChoiceInputField {
  kind: "multiSelect";
  itemType?: "string" | "number" | "integer" | "boolean" | "null";
  placeholder?: string;
  schemaType: "array";
}

export interface InputFieldOption {
  label: string;
  value: JsonPrimitive;
}

export type InputFieldKind = InputField["kind"];
export type InputSchemaType = NonNullable<InputField["schemaType"]>;
export type InputArrayItemType = NonNullable<InputField["itemType"]>;
