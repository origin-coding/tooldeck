import { TooldeckError } from "@tooldeck/shared";
import type { JsonValue } from "@tooldeck/shared";
import type { ErrorObject } from "ajv";

import type { CommandInputContext, CommandInputIssue } from "./command-input-types";

export function throwAjvCommandInputError(options: {
  errors: ErrorObject[];
  context: CommandInputContext;
}): never {
  const error = options.errors[0];

  if (!error) {
    throwCommandInputError({
      issue: "invalid_type",
      message: "Invalid command input",
      commandId: options.context.commandId,
    });
  }

  const converted = convertAjvError(error);
  const propertyPath = converted.propertyPath;

  throwCommandInputError({
    issue: converted.issue,
    message: formatAjvErrorMessage(converted.issue, propertyPath, converted.expected),
    commandId: options.context.commandId,
    propertyPath,
    schemaKeyword: error.keyword,
    expected: converted.expected,
    actual: converted.actual,
  });
}

export function throwExpectedTypeError(
  propertyPath: string,
  expectedType: string,
  value: unknown,
  context: CommandInputContext,
): never {
  throwCommandInputError({
    issue: "invalid_type",
    message: `Expected ${expectedType} for command input: ${formatPropertyForMessage(propertyPath)}`,
    commandId: context.commandId,
    propertyPath,
    schemaKeyword: "type",
    expected: expectedType,
    actual: describeActualValue(value),
  });
}

export function throwNotJsonSerializableError(
  propertyPath: string,
  value: unknown,
  context: CommandInputContext,
): never {
  throwCommandInputError({
    issue: "not_json_serializable",
    message: `Command input is not JSON serializable: ${formatPropertyForMessage(propertyPath)}`,
    commandId: context.commandId,
    propertyPath,
    actual: describeActualValue(value),
  });
}

function convertAjvError(error: ErrorObject): {
  issue: CommandInputIssue;
  propertyPath: string;
  expected?: JsonValue | JsonValue[];
  actual?: JsonValue;
} {
  switch (error.keyword) {
    case "additionalProperties": {
      const additionalProperty = readStringParam(error, "additionalProperty");
      return {
        issue: "unknown_property",
        propertyPath: appendProperty(
          jsonPointerToPropertyPath(error.instancePath),
          additionalProperty,
        ),
      };
    }
    case "required": {
      const missingProperty = readStringParam(error, "missingProperty");
      return {
        issue: "missing_required",
        propertyPath: appendProperty(
          jsonPointerToPropertyPath(error.instancePath),
          missingProperty,
        ),
      };
    }
    case "type":
      return {
        issue: "invalid_type",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readExpectedType(error),
        actual: describeActualValue(error.data),
      };
    case "minimum":
      return {
        issue: "below_minimum",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "maximum":
      return {
        issue: "above_maximum",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "exclusiveMinimum":
      return {
        issue: "below_exclusive_minimum",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "exclusiveMaximum":
      return {
        issue: "above_exclusive_maximum",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "minLength":
      return {
        issue: "below_min_length",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "maxLength":
      return {
        issue: "above_max_length",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: jsonValueOrDescription(error.data),
      };
    case "pattern":
      return {
        issue: "pattern_mismatch",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readStringParam(error, "pattern"),
        actual: jsonValueOrDescription(error.data),
      };
    case "enum":
      return {
        issue: "invalid_enum",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: Array.isArray(error.schema) ? error.schema : undefined,
        actual: jsonValueOrDescription(error.data),
      };
    case "const":
      return {
        issue: "invalid_const",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: jsonValueOrDescription(error.schema),
        actual: jsonValueOrDescription(error.data),
      };
    case "minItems":
      return {
        issue: "below_min_items",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: Array.isArray(error.data) ? error.data.length : describeActualValue(error.data),
      };
    case "maxItems":
      return {
        issue: "above_max_items",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        expected: readNumberParam(error, "limit"),
        actual: Array.isArray(error.data) ? error.data.length : describeActualValue(error.data),
      };
    case "uniqueItems":
      return {
        issue: "duplicate_items",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
      };
    default:
      return {
        issue: "invalid_type",
        propertyPath: jsonPointerToPropertyPath(error.instancePath),
        actual: jsonValueOrDescription(error.data),
      };
  }
}

function formatAjvErrorMessage(
  issue: CommandInputIssue,
  propertyPath: string,
  expected: JsonValue | JsonValue[] | undefined,
): string {
  const property = formatPropertyForMessage(propertyPath);

  switch (issue) {
    case "unknown_property":
      return `Unknown command input argument: ${property}`;
    case "missing_required":
      return `Missing required command input: ${property}`;
    case "invalid_type":
      return `Expected ${typeof expected === "string" ? expected : "valid type"} for command input: ${property}`;
    case "below_minimum":
      return `Command input is below minimum: ${property}`;
    case "above_maximum":
      return `Command input is above maximum: ${property}`;
    case "below_exclusive_minimum":
      return `Command input must be greater than exclusiveMinimum: ${property}`;
    case "above_exclusive_maximum":
      return `Command input must be less than exclusiveMaximum: ${property}`;
    case "below_min_length":
      return `Command input is shorter than minLength: ${property}`;
    case "above_max_length":
      return `Command input is longer than maxLength: ${property}`;
    case "pattern_mismatch":
      return `Command input does not match pattern: ${property}`;
    case "invalid_enum":
      return `Invalid value for command input: ${property}`;
    case "invalid_const":
      return `Invalid const value for command input: ${property}`;
    case "below_min_items":
      return `Command input has fewer items than minItems: ${property}`;
    case "above_max_items":
      return `Command input has more items than maxItems: ${property}`;
    case "duplicate_items":
      return `Command input has duplicate items: ${property}`;
    case "not_json_serializable":
      return `Command input is not JSON serializable: ${property}`;
  }
}

function throwCommandInputError(options: {
  issue: CommandInputIssue;
  message: string;
  commandId?: string;
  propertyPath?: string;
  schemaKeyword?: string;
  expected?: JsonValue | JsonValue[];
  actual?: JsonValue;
}): never {
  throw new TooldeckError({
    code: "ERR_INVALID_ARGUMENT",
    message: options.message,
    details: {
      issue: options.issue,
      commandId: options.commandId ?? null,
      propertyPath: options.propertyPath ?? null,
      schemaKeyword: options.schemaKeyword ?? null,
      expected: options.expected ?? null,
      actual: options.actual ?? null,
    },
  });
}

function jsonPointerToPropertyPath(pointer: string): string {
  if (!pointer) {
    return "";
  }

  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce(
      (path, part) => (/^\d+$/.test(part) ? `${path}[${part}]` : appendProperty(path, part)),
      "",
    );
}

function appendProperty(parentPath: string, propertyName: string): string {
  return parentPath ? `${parentPath}.${propertyName}` : propertyName;
}

function formatPropertyForMessage(propertyPath: string): string {
  return propertyPath ? `--${propertyPath}` : "--";
}

function readStringParam(error: ErrorObject, key: string): string {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "string" ? value : "";
}

function readNumberParam(error: ErrorObject, key: string): number | undefined {
  const value = (error.params as Record<string, unknown>)[key];

  return typeof value === "number" ? value : undefined;
}

function readExpectedType(error: ErrorObject): string | undefined {
  const value = (error.params as Record<string, unknown>).type;

  return typeof value === "string" ? value : undefined;
}

function jsonValueOrDescription(value: unknown): JsonValue {
  return isJsonValue(value) ? value : describeActualValue(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function describeActualValue(value: unknown): JsonValue {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}
