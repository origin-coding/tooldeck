import type { TooldeckJsonSchema } from "@tooldeck/protocol";
import { TooldeckError } from "@tooldeck/shared";
import type { JsonObject, JsonValue } from "@tooldeck/shared";

export interface NormalizeCommandInputOptions {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckJsonSchema;
  commandId?: string;
}

export interface ParseCommandInputFromCliArgsOptions {
  rawArgs: string[];
  commandId: string;
  inputSchema?: TooldeckJsonSchema;
  ignoredOptions?: string[];
}

export interface ParseRawCommandInputFromCliArgsOptions {
  rawArgs: string[];
  commandId: string;
  ignoredOptions?: string[];
}

type RawCliOptionValue = string | boolean;
type CommandInputIssue =
  | "unknown_property"
  | "missing_required"
  | "invalid_type"
  | "below_minimum"
  | "above_maximum"
  | "below_exclusive_minimum"
  | "above_exclusive_maximum"
  | "below_min_length"
  | "above_max_length"
  | "pattern_mismatch"
  | "invalid_enum"
  | "not_json_serializable";

export function parseCommandInputFromCliArgs(
  options: ParseCommandInputFromCliArgsOptions,
): JsonObject {
  return normalizeCommandInput({
    input: parseRawCliInputOptions({
      rawArgs: options.rawArgs,
      commandId: options.commandId,
      ignoredOptions: options.ignoredOptions ?? [],
    }),
    inputSchema: options.inputSchema,
    commandId: options.commandId,
  });
}

export function parseRawCommandInputFromCliArgs(
  options: ParseRawCommandInputFromCliArgsOptions,
): JsonObject {
  return toJsonObject(
    parseRawCliInputOptions({
      rawArgs: options.rawArgs,
      commandId: options.commandId,
      ignoredOptions: options.ignoredOptions ?? [],
    }),
  );
}

export function normalizeCommandInput(options: NormalizeCommandInputOptions): JsonObject {
  const input = options.input ?? {};
  const inputSchema = options.inputSchema;

  if (!inputSchema) {
    return toJsonObject(input);
  }

  const properties = normalizeJsonSchemaProperties(inputSchema.properties);
  const additionalProperties = inputSchema.additionalProperties;
  const normalized: JsonObject = {};

  for (const [propertyName, value] of Object.entries(input)) {
    const propertySchema = properties[propertyName];

    if (propertySchema) {
      normalized[propertyName] = normalizeCommandInputValue(propertyName, value, propertySchema, {
        commandId: options.commandId,
      });
      continue;
    }

    if (additionalProperties === false) {
      throwCommandInputError({
        issue: "unknown_property",
        message: `Unknown command input argument: --${propertyName}`,
        commandId: options.commandId,
        propertyPath: propertyName,
        schemaKeyword: "additionalProperties",
      });
    }

    const additionalPropertySchema = normalizeJsonSchemaProperty(additionalProperties);

    if (additionalPropertySchema) {
      normalized[propertyName] = normalizeCommandInputValue(
        propertyName,
        value,
        additionalPropertySchema,
        {
          commandId: options.commandId,
        },
      );
      continue;
    }

    normalized[propertyName] = toJsonValue(propertyName, value, {
      commandId: options.commandId,
    });
  }

  const required = new Set(inputSchema.required ?? []);

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    if (propertyName in normalized) {
      continue;
    }

    if ("default" in propertySchema && isJsonValue(propertySchema.default)) {
      normalized[propertyName] = propertySchema.default;
      continue;
    }

    if (required.has(propertyName)) {
      throwCommandInputError({
        issue: "missing_required",
        message: `Missing required command input: --${propertyName}`,
        commandId: options.commandId,
        propertyPath: propertyName,
        schemaKeyword: "required",
      });
    }
  }

  return normalized;
}

function parseRawCliInputOptions(options: {
  rawArgs: string[];
  commandId: string;
  ignoredOptions: string[];
}): Record<string, RawCliOptionValue> {
  const input: Record<string, RawCliOptionValue> = {};
  const ignoredOptions = new Set(options.ignoredOptions);
  let commandIdConsumed = false;

  for (let index = 0; index < options.rawArgs.length; index += 1) {
    const token = options.rawArgs[index];

    if (token === "--") {
      break;
    }

    if (!token.startsWith("--")) {
      if (!commandIdConsumed && token === options.commandId) {
        commandIdConsumed = true;
      }

      continue;
    }

    const optionToken = token.slice(2);
    const equalsIndex = optionToken.indexOf("=");
    const optionName = equalsIndex >= 0 ? optionToken.slice(0, equalsIndex) : optionToken;

    if (ignoredOptions.has(optionName)) {
      if (equalsIndex < 0) {
        index += 1;
      }

      continue;
    }

    if (optionName.startsWith("no-")) {
      input[toCamelCase(optionName.slice(3))] = false;
      continue;
    }

    if (equalsIndex >= 0) {
      input[toCamelCase(optionName)] = optionToken.slice(equalsIndex + 1);
      continue;
    }

    const nextToken = options.rawArgs[index + 1];

    if (nextToken !== undefined && !nextToken.startsWith("--")) {
      input[toCamelCase(optionName)] = nextToken;
      index += 1;
    } else {
      input[toCamelCase(optionName)] = true;
    }
  }

  return input;
}

function normalizeJsonSchemaProperties(
  properties: TooldeckJsonSchema["properties"],
): Record<string, TooldeckJsonSchema> {
  const normalized: Record<string, TooldeckJsonSchema> = {};

  if (!properties) {
    return normalized;
  }

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    const normalizedProperty = normalizeJsonSchemaProperty(propertySchema);

    if (normalizedProperty) {
      normalized[propertyName] = normalizedProperty;
    }
  }

  return normalized;
}

function normalizeJsonSchemaProperty(property: unknown): TooldeckJsonSchema | undefined {
  if (typeof property !== "object" || property === null || Array.isArray(property)) {
    return undefined;
  }

  return property;
}

function normalizeCommandInputValue(
  propertyName: string,
  value: unknown,
  schema: TooldeckJsonSchema,
  context: CommandInputErrorContext,
): JsonValue {
  const type = getJsonSchemaType(schema);
  let normalized: JsonValue;

  if (type === "integer") {
    normalized = normalizeIntegerValue(propertyName, value, context);
    validateNumberRange(propertyName, normalized, schema, context);
  } else if (type === "number") {
    normalized = normalizeNumberValue(propertyName, value, context);
    validateNumberRange(propertyName, normalized, schema, context);
  } else if (type === "boolean") {
    normalized = normalizeBooleanValue(propertyName, value, context);
  } else if (type === "string") {
    normalized = normalizeStringValue(propertyName, value, context);
    validateString(propertyName, normalized, schema, context);
  } else {
    normalized = toJsonValue(propertyName, value, context);
  }

  validateEnum(propertyName, normalized, schema, context);

  return normalized;
}

function normalizeIntegerValue(
  propertyName: string,
  value: unknown,
  context: CommandInputErrorContext,
): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throwExpectedTypeError(propertyName, "integer", value, context);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throwExpectedTypeError(propertyName, "integer", value, context);
  }

  return parsed;
}

function normalizeNumberValue(
  propertyName: string,
  value: unknown,
  context: CommandInputErrorContext,
): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throwExpectedTypeError(propertyName, "number", value, context);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throwExpectedTypeError(propertyName, "number", value, context);
  }

  return parsed;
}

function normalizeBooleanValue(
  propertyName: string,
  value: unknown,
  context: CommandInputErrorContext,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throwExpectedTypeError(propertyName, "boolean", value, context);
}

function normalizeStringValue(
  propertyName: string,
  value: unknown,
  context: CommandInputErrorContext,
): string {
  if (typeof value === "string") {
    return value;
  }

  throwExpectedTypeError(propertyName, "string", value, context);
}

function validateNumberRange(
  propertyName: string,
  value: number,
  schema: TooldeckJsonSchema,
  context: CommandInputErrorContext,
): void {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    throwCommandInputError({
      issue: "below_minimum",
      message: `Command input is below minimum: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "minimum",
      expected: schema.minimum,
      actual: value,
    });
  }

  if (typeof schema.maximum === "number" && value > schema.maximum) {
    throwCommandInputError({
      issue: "above_maximum",
      message: `Command input is above maximum: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "maximum",
      expected: schema.maximum,
      actual: value,
    });
  }

  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
    throwCommandInputError({
      issue: "below_exclusive_minimum",
      message: `Command input must be greater than exclusiveMinimum: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "exclusiveMinimum",
      expected: schema.exclusiveMinimum,
      actual: value,
    });
  }

  if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
    throwCommandInputError({
      issue: "above_exclusive_maximum",
      message: `Command input must be less than exclusiveMaximum: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "exclusiveMaximum",
      expected: schema.exclusiveMaximum,
      actual: value,
    });
  }
}

function validateString(
  propertyName: string,
  value: string,
  schema: TooldeckJsonSchema,
  context: CommandInputErrorContext,
): void {
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    throwCommandInputError({
      issue: "below_min_length",
      message: `Command input is shorter than minLength: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "minLength",
      expected: schema.minLength,
      actual: value.length,
    });
  }

  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    throwCommandInputError({
      issue: "above_max_length",
      message: `Command input is longer than maxLength: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "maxLength",
      expected: schema.maxLength,
      actual: value.length,
    });
  }

  if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
    throwCommandInputError({
      issue: "pattern_mismatch",
      message: `Command input does not match pattern: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "pattern",
      expected: schema.pattern,
      actual: value,
    });
  }
}

function validateEnum(
  propertyName: string,
  value: JsonValue,
  schema: TooldeckJsonSchema,
  context: CommandInputErrorContext,
): void {
  if (!schema.enum) {
    return;
  }

  if (!schema.enum.some((item) => item === value)) {
    throwCommandInputError({
      issue: "invalid_enum",
      message: `Invalid value for command input: --${propertyName}`,
      commandId: context.commandId,
      propertyPath: propertyName,
      schemaKeyword: "enum",
      expected: schema.enum,
      actual: value,
    });
  }
}

function getJsonSchemaType(schema: TooldeckJsonSchema): string {
  if (!schema.type) {
    return "string";
  }

  return Array.isArray(schema.type) ? schema.type[0] : schema.type;
}

function toJsonObject(input: Record<string, unknown>): JsonObject {
  const output: JsonObject = {};

  for (const [propertyName, value] of Object.entries(input)) {
    output[propertyName] = toJsonValue(propertyName, value, {});
  }

  return output;
}

function toJsonValue(
  propertyName: string,
  value: unknown,
  context: CommandInputErrorContext,
): JsonValue {
  if (isJsonValue(value)) {
    return value;
  }

  throwCommandInputError({
    issue: "not_json_serializable",
    message: `Command input is not JSON serializable: --${propertyName}`,
    commandId: context.commandId,
    propertyPath: propertyName,
  });
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

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

interface CommandInputErrorContext {
  commandId?: string;
}

function throwExpectedTypeError(
  propertyName: string,
  expectedType: string,
  value: unknown,
  context: CommandInputErrorContext,
): never {
  throwCommandInputError({
    issue: "invalid_type",
    message: `Expected ${expectedType} for command input: --${propertyName}`,
    commandId: context.commandId,
    propertyPath: propertyName,
    schemaKeyword: "type",
    expected: expectedType,
    actual: describeActualValue(value),
  });
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

function describeActualValue(value: unknown): JsonValue {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  return typeof value;
}
