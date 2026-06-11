import type { JSONSchema7 } from "json-schema";

import type { LocalizedString, TranslationKey } from "./i18n";

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

export type TooldeckJsonSchema = JSONSchema7 & {
  "x-i18n"?: JsonSchemaI18n;
  "x-enumLabels"?: Record<string, string>;
};

export type TooldeckInputFieldJsonSchema = TooldeckJsonSchema & {
  "x-ui"?: JsonSchemaFieldUi;
  "x-enumLabels"?: Record<string, string>;
};

export type TooldeckInputJsonSchema = Omit<TooldeckJsonSchema, "properties"> & {
  "x-ui"?: JsonSchemaRootUi;
  properties?: Record<string, TooldeckInputFieldJsonSchema | boolean>;
};
