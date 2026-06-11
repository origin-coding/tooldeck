import type { JSONSchema7 } from "json-schema";

import type { TranslationKey } from "./i18n";

export interface JsonSchemaI18n {
  title?: TranslationKey;
  description?: TranslationKey;
}

export interface JsonSchemaUi {
  fieldOrder?: string[];
}

export type TooldeckJsonSchema = JSONSchema7 & {
  "x-i18n"?: JsonSchemaI18n;
};

export type TooldeckInputJsonSchema = TooldeckJsonSchema & {
  "x-ui"?: JsonSchemaUi;
};
