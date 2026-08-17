import type { JsonValue } from "@tooldeck/protocol";
import type { ErrorObject } from "ajv";

import type { JsonSchemaIssue } from "../contracts";
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
      instancePath: "",
      propertyPath: "",
      keyword: "pattern",
      message: "Pattern is not a valid regular expression",
    };
  }

  if (message.includes("unknown format")) {
    return {
      instancePath: "",
      propertyPath: "",
      keyword: "format",
      message: "Schema uses an unsupported format",
    };
  }

  return {
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
    instancePath: error.instancePath,
    propertyPath: jsonPointerToPropertyPath(propertyPointer),
    keyword: error.keyword,
    message: formatIssueMessage(error.keyword),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
  };
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

function readParamString(error: ErrorObject, key: string): string | undefined {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "string" ? value : undefined;
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
