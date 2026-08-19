import type { JsonObject, JsonValue } from "@tooldeck/protocol";
import type { ErrorObject } from "ajv";

import type { JsonSchemaIssue, JsonSchemaIssueCode } from "../contracts";
import {
  appendJsonPointer,
  cloneJsonValue,
  jsonPointerToPropertyPath,
  readJsonPointer,
} from "./json";

/** @internal */
export function normalizeAjvErrors(
  errors: readonly ErrorObject[],
  rootValue: JsonValue,
): JsonSchemaIssue[] {
  return errors.map((error) => normalizeAjvError(error, rootValue)).sort(compareIssues);
}

/** @internal */
export function createCompilationIssue(error: unknown): JsonSchemaIssue {
  const missingRef = readErrorString(error, "missingRef");

  if (missingRef) {
    return {
      code: "schema.unresolved-reference",
      instancePath: "",
      propertyPath: "",
      keyword: "$ref",
      message: "Schema reference could not be resolved",
      expected: missingRef,
    };
  }

  const message = error instanceof Error ? error.message : "";

  if (message.includes("regular expression") || message.includes("Invalid escape")) {
    return {
      code: "schema.invalid-pattern",
      instancePath: "",
      propertyPath: "",
      keyword: "pattern",
      message: "Pattern is not a valid regular expression",
    };
  }

  if (message.includes("unknown format")) {
    return {
      code: "schema.unsupported-format",
      instancePath: "",
      propertyPath: "",
      keyword: "format",
      message: "Schema uses an unsupported format",
    };
  }

  return {
    code: "schema.compilation-failed",
    instancePath: "",
    propertyPath: "",
    keyword: "compile",
    message: "Schema could not be compiled",
  };
}

/** @internal */
export function compareIssues(left: JsonSchemaIssue, right: JsonSchemaIssue): number {
  return (
    compareStrings(left.propertyPath, right.propertyPath) ||
    compareStrings(left.keyword, right.keyword) ||
    compareStrings(left.message, right.message)
  );
}

function normalizeAjvError(error: ErrorObject, rootValue: JsonValue): JsonSchemaIssue {
  const relatedProperty = readRelatedProperty(error);
  const propertyPointer = relatedProperty
    ? appendJsonPointer(error.instancePath, relatedProperty)
    : error.instancePath;
  const expected = readExpected(error);
  const actual = readActual(error, rootValue, propertyPointer);

  return {
    code: issueCodeForKeyword(error.keyword),
    instancePath: error.instancePath,
    propertyPath: jsonPointerToPropertyPath(propertyPointer),
    keyword: error.keyword,
    message: formatIssueMessage(error.keyword),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
    ...readParameters(error),
  };
}

function issueCodeForKeyword(keyword: string): JsonSchemaIssueCode {
  const codes: Record<string, JsonSchemaIssueCode> = {
    additionalProperties: "json-schema.additional-property",
    const: "json-schema.constant",
    enum: "json-schema.enum",
    exclusiveMaximum: "json-schema.exclusive-maximum",
    exclusiveMinimum: "json-schema.exclusive-minimum",
    "false schema": "json-schema.false-schema",
    maximum: "json-schema.maximum",
    maxItems: "json-schema.max-items",
    maxLength: "json-schema.max-length",
    maxProperties: "json-schema.max-properties",
    minimum: "json-schema.minimum",
    minItems: "json-schema.min-items",
    minLength: "json-schema.min-length",
    minProperties: "json-schema.min-properties",
    multipleOf: "json-schema.multiple-of",
    pattern: "json-schema.pattern",
    required: "json-schema.required",
    type: "json-schema.type",
    uniqueItems: "json-schema.unique-items",
  };

  return codes[keyword] ?? "json-schema.validation-failed";
}

function readParameters(error: ErrorObject): { parameters: JsonObject } | object {
  const parameters = normalizedParameters(error);

  return Object.keys(parameters).length > 0 ? { parameters } : {};
}

function normalizedParameters(error: ErrorObject): JsonObject {
  switch (error.keyword) {
    case "additionalProperties":
      return stringParameter(error, "additionalProperty", "property");
    case "required":
      return stringParameter(error, "missingProperty", "property");
    case "type":
      return stringParameter(error, "type", "type");
    case "pattern":
      return stringParameter(error, "pattern", "pattern");
    case "enum":
      return jsonParameter(error, "allowedValues", "allowedValues");
    case "const":
      return jsonParameter(error, "allowedValue", "allowedValue");
    case "maximum":
    case "minimum":
    case "exclusiveMaximum":
    case "exclusiveMinimum":
    case "maxItems":
    case "minItems":
    case "maxLength":
    case "minLength":
    case "maxProperties":
    case "minProperties":
      return numberParameter(error, "limit", "limit");
    case "multipleOf":
      return numberParameter(error, "multipleOf", "multipleOf");
    case "uniqueItems":
      return {
        ...numberParameter(error, "i", "firstIndex"),
        ...numberParameter(error, "j", "secondIndex"),
      };
    default:
      return {};
  }
}

function readRelatedProperty(error: ErrorObject): string | undefined {
  if (error.keyword === "required") {
    return readParamString(error, "missingProperty");
  }

  if (error.keyword === "additionalProperties") {
    return readParamString(error, "additionalProperty");
  }

  return undefined;
}

function readExpected(error: ErrorObject): JsonValue | JsonValue[] | undefined {
  if (error.keyword === "required") {
    return readParamString(error, "missingProperty");
  }

  if (error.keyword === "additionalProperties") {
    return readParamString(error, "additionalProperty");
  }

  if (error.keyword === "type") {
    return readParamString(error, "type");
  }

  return tryCloneJsonValue(error.schema);
}

function readActual(
  error: ErrorObject,
  rootValue: JsonValue,
  propertyPointer: string,
): JsonValue | undefined {
  if (error.keyword === "required") {
    return undefined;
  }

  return readJsonPointer(rootValue, propertyPointer);
}

function tryCloneJsonValue(value: unknown): JsonValue | undefined {
  const cloned = cloneJsonValue(value);

  return cloned.valid ? cloned.value : undefined;
}

function stringParameter(error: ErrorObject, source: string, target: string): JsonObject {
  const value = readParamString(error, source);

  return value === undefined ? {} : { [target]: value };
}

function numberParameter(error: ErrorObject, source: string, target: string): JsonObject {
  const value = readParamNumber(error, source);

  return value === undefined ? {} : { [target]: value };
}

function jsonParameter(error: ErrorObject, source: string, target: string): JsonObject {
  const value = (error.params as Record<string, unknown>)[source];
  const cloned = cloneJsonValue(value);

  return cloned.valid ? { [target]: cloned.value } : {};
}

function readParamString(error: ErrorObject, key: string): string | undefined {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
}

function readParamNumber(error: ErrorObject, key: string): number | undefined {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readErrorString(error: unknown, key: string): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = (error as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
}

function formatIssueMessage(keyword: string): string {
  const messages: Record<string, string> = {
    additionalProperties: "Additional property is not allowed",
    const: "Value must equal the declared constant",
    enum: "Value must be one of the allowed values",
    exclusiveMaximum: "Number must be below the exclusive maximum",
    exclusiveMinimum: "Number must be above the exclusive minimum",
    "false schema": "Value is not allowed",
    maxItems: "Array has too many items",
    maxLength: "String is too long",
    maxProperties: "Object has too many properties",
    maximum: "Number exceeds the maximum",
    minItems: "Array has too few items",
    minLength: "String is too short",
    minProperties: "Object has too few properties",
    minimum: "Number is below the minimum",
    multipleOf: "Number is not a valid multiple",
    pattern: "String does not match the required pattern",
    required: "Required property is missing",
    type: "Value has the wrong type",
    uniqueItems: "Array items must be unique",
  };

  return messages[keyword] ?? "Value failed JSON Schema validation";
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}
