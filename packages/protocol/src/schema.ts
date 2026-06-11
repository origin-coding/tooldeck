import type { JSONSchema7 } from "json-schema";

import type { LocalizedString, TranslationKey } from "./i18n";

export interface JsonSchemaI18n {
  title?: TranslationKey;
  description?: TranslationKey;
}

export interface JsonSchemaRootUi {
  fieldOrder?: string[];
}

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
    };

export type JsonSchemaUi = JsonSchemaRootUi;

export type TooldeckJsonSchema = JSONSchema7 & {
  "x-i18n"?: JsonSchemaI18n;
};

export type TooldeckInputFieldJsonSchema = TooldeckJsonSchema & {
  "x-ui"?: JsonSchemaFieldUi;
};

export type TooldeckInputJsonSchema = Omit<TooldeckJsonSchema, "properties"> & {
  "x-ui"?: JsonSchemaRootUi;
  properties?: Record<string, TooldeckInputFieldJsonSchema | boolean>;
};
