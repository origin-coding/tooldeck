import type { JsonObject, JsonValue } from "@tooldeck/protocol";

export type JsonSchemaDocument = boolean | JsonObject;

export type JsonSchemaIssueCode =
  | "json-value.not-json-safe"
  | "schema.invalid-root"
  | "schema.unresolved-reference"
  | "schema.invalid-pattern"
  | "schema.unsupported-format"
  | "schema.compilation-failed"
  | "json-schema.validation-failed"
  | "json-schema.additional-property"
  | "json-schema.constant"
  | "json-schema.enum"
  | "json-schema.exclusive-maximum"
  | "json-schema.exclusive-minimum"
  | "json-schema.false-schema"
  | "json-schema.maximum"
  | "json-schema.max-items"
  | "json-schema.max-length"
  | "json-schema.max-properties"
  | "json-schema.minimum"
  | "json-schema.min-items"
  | "json-schema.min-length"
  | "json-schema.min-properties"
  | "json-schema.multiple-of"
  | "json-schema.pattern"
  | "json-schema.required"
  | "json-schema.type"
  | "json-schema.unique-items"
  | "tooldeck.input-ui.unsupported-property"
  | "tooldeck.input-ui.invalid-location"
  | "tooldeck.input-ui.control.unsupported-property"
  | "tooldeck.input-ui.control.incompatible"
  | "tooldeck.input-ui.field-order.unknown-property"
  | "tooldeck.output-ui.forbidden"
  | "tooldeck.enum-labels.missing-enum"
  | "tooldeck.enum-labels.unknown-value";

export type JsonSchemaIssue = JsonObject & {
  code: JsonSchemaIssueCode;
  instancePath: string;
  propertyPath: string;
  keyword: string;
  message: string;
  expected?: JsonValue | JsonValue[];
  actual?: JsonValue;
  parameters?: JsonObject;
};

export type JsonSchemaValidationError = JsonObject & {
  kind: "validation";
  code: "value_does_not_match_schema";
  message: string;
  issues: JsonSchemaIssue[];
};

export type JsonSchemaCompilationError = JsonObject & {
  kind: "compilation";
  code: "schema_could_not_be_compiled";
  message: string;
  issues: JsonSchemaIssue[];
};

export type JsonSchemaError = JsonSchemaValidationError | JsonSchemaCompilationError;

export type JsonSchemaValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: JsonSchemaValidationError };

export interface TooldeckJsonSchemaValidator<T> {
  validate(value: unknown): JsonSchemaValidationResult<T>;
}

export type JsonSchemaCompilationResult<T> =
  | { compiled: true; validator: TooldeckJsonSchemaValidator<T> }
  | { compiled: false; error: JsonSchemaCompilationError };
