import type { JsonObject, JsonValue } from "@tooldeck/protocol";

export type JsonSchemaDocument = boolean | JsonObject;

export interface JsonSchemaIssue {
  instancePath: string;
  propertyPath: string;
  keyword: string;
  message: string;
  expected?: JsonValue | JsonValue[];
  actual?: JsonValue;
}

export type JsonSchemaValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; issues: JsonSchemaIssue[] };

export interface TooldeckJsonSchemaValidator<T> {
  validate(value: unknown): JsonSchemaValidationResult<T>;
}

export type JsonSchemaCompilationResult<T> =
  | { compiled: true; validator: TooldeckJsonSchemaValidator<T> }
  | { compiled: false; issues: JsonSchemaIssue[] };
