import type { LocalizedString, TranslationKey } from "./i18n";
import type { JsonValue } from "./json";

export const commandInputSchemaProfileV1Id =
  "https://tooldeck.dev/schemas/command-input-v1.schema.json" as const;
export const commandOutputSchemaProfileV1Id =
  "https://tooldeck.dev/schemas/command-output-v1.schema.json" as const;

export type JsonSchemaType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null";

export interface JsonSchemaI18n {
  title?: TranslationKey;
  description?: TranslationKey;
  enumLabels?: Record<string, TranslationKey>;
}

export interface JsonSchemaRootUi {
  fieldOrder?: string[];
}

export type JsonSchemaFieldControl =
  | "text"
  | "textarea"
  | "number"
  | "checkbox"
  | "radio"
  | "select"
  | "checkboxGroup"
  | "multiSelect";

export type JsonSchemaFieldUi =
  | {
      control: "text";
      placeholder?: LocalizedString;
    }
  | {
      control: "textarea";
      rows?: number;
      placeholder?: LocalizedString;
    }
  | {
      control: "number";
      placeholder?: LocalizedString;
    }
  | {
      control: "checkbox";
    }
  | {
      control: "radio";
    }
  | {
      control: "select";
      placeholder?: LocalizedString;
    }
  | {
      control: "checkboxGroup";
    }
  | {
      control: "multiSelect";
      placeholder?: LocalizedString;
    };

export type JsonSchemaUi = JsonSchemaRootUi;

/**
 * Object form shared by nested Tooldeck command input Schemas.
 *
 * This intentionally describes only the command-input-v1 keyword profile. It is
 * not an alias for the complete JSON Schema Draft-07 vocabulary.
 */
export interface TooldeckJsonSchema {
  type?: JsonSchemaType;
  properties?: Record<string, TooldeckJsonSchema | boolean>;
  required?: string[];
  additionalProperties?: boolean | TooldeckJsonSchema;
  items?: TooldeckJsonSchema;
  allOf?: TooldeckJsonSchema[];
  enum?: JsonValue[];
  const?: JsonValue;
  default?: JsonValue;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  title?: string;
  description?: string;
  examples?: JsonValue[];
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  "x-i18n"?: JsonSchemaI18n;
  "x-enumLabels"?: Record<string, string>;
}

export type TooldeckInputFieldJsonSchema = TooldeckJsonSchema & {
  "x-ui"?: JsonSchemaFieldUi;
};

export type TooldeckInputJsonSchema = Omit<TooldeckJsonSchema, "type" | "properties"> & {
  type: "object";
  "x-ui"?: JsonSchemaRootUi;
  properties?: Record<string, TooldeckInputFieldJsonSchema | boolean>;
};

/** Object form allowed at nested nodes of command-output-v1. */
export interface TooldeckOutputSchemaObject {
  type?: JsonSchemaType;
  properties?: Record<string, TooldeckOutputSchemaObject | boolean>;
  required?: string[];
  additionalProperties?: boolean | TooldeckOutputSchemaObject;
  items?: TooldeckOutputSchemaObject;
  allOf?: TooldeckOutputSchemaObject[];
  enum?: JsonValue[];
  const?: JsonValue;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  title?: string;
  description?: string;
  examples?: JsonValue[];
}

export type TooldeckOutputJsonSchema = Omit<TooldeckOutputSchemaObject, "type"> & {
  type: "object";
};
