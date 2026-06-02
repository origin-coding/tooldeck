import type { TooldeckJsonSchema } from "@tooldeck/protocol";
import type { JsonObject, JsonValue } from "@tooldeck/shared";

export interface NormalizeCommandInputOptions {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckJsonSchema;
}

export interface ParseCommandInputFromCliArgsOptions {
  rawArgs: string[];
  commandId: string;
  inputSchema?: TooldeckJsonSchema;
  ignoredOptions?: string[];
}

type RawCliOptionValue = string | boolean;

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
  });
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
      normalized[propertyName] = normalizeCommandInputValue(propertyName, value, propertySchema);
      continue;
    }

    if (additionalProperties === false) {
      throw new Error(`Unknown command input argument: --${propertyName}`);
    }

    const additionalPropertySchema = normalizeJsonSchemaProperty(additionalProperties);

    if (additionalPropertySchema) {
      normalized[propertyName] = normalizeCommandInputValue(
        propertyName,
        value,
        additionalPropertySchema,
      );
      continue;
    }

    normalized[propertyName] = toJsonValue(propertyName, value);
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
      throw new Error(`Missing required command input: --${propertyName}`);
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
): JsonValue {
  const type = getJsonSchemaType(schema);
  let normalized: JsonValue;

  if (type === "integer") {
    normalized = normalizeIntegerValue(propertyName, value);
    validateNumberRange(propertyName, normalized, schema);
  } else if (type === "number") {
    normalized = normalizeNumberValue(propertyName, value);
    validateNumberRange(propertyName, normalized, schema);
  } else if (type === "boolean") {
    normalized = normalizeBooleanValue(propertyName, value);
  } else if (type === "string") {
    normalized = normalizeStringValue(propertyName, value);
    validateString(propertyName, normalized, schema);
  } else {
    normalized = toJsonValue(propertyName, value);
  }

  validateEnum(propertyName, normalized, schema);

  return normalized;
}

function normalizeIntegerValue(propertyName: string, value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected integer for command input: --${propertyName}`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected integer for command input: --${propertyName}`);
  }

  return parsed;
}

function normalizeNumberValue(propertyName: string, value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Expected number for command input: --${propertyName}`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected number for command input: --${propertyName}`);
  }

  return parsed;
}

function normalizeBooleanValue(propertyName: string, value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  throw new Error(`Expected boolean for command input: --${propertyName}`);
}

function normalizeStringValue(propertyName: string, value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  throw new Error(`Expected string for command input: --${propertyName}`);
}

function validateNumberRange(
  propertyName: string,
  value: number,
  schema: TooldeckJsonSchema,
): void {
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    throw new Error(`Command input is below minimum: --${propertyName}`);
  }

  if (typeof schema.maximum === "number" && value > schema.maximum) {
    throw new Error(`Command input is above maximum: --${propertyName}`);
  }

  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
    throw new Error(`Command input must be greater than exclusiveMinimum: --${propertyName}`);
  }

  if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
    throw new Error(`Command input must be less than exclusiveMaximum: --${propertyName}`);
  }
}

function validateString(propertyName: string, value: string, schema: TooldeckJsonSchema): void {
  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    throw new Error(`Command input is shorter than minLength: --${propertyName}`);
  }

  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    throw new Error(`Command input is longer than maxLength: --${propertyName}`);
  }

  if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) {
    throw new Error(`Command input does not match pattern: --${propertyName}`);
  }
}

function validateEnum(propertyName: string, value: JsonValue, schema: TooldeckJsonSchema): void {
  if (!schema.enum) {
    return;
  }

  if (!schema.enum.some((item) => item === value)) {
    throw new Error(`Invalid value for command input: --${propertyName}`);
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
    output[propertyName] = toJsonValue(propertyName, value);
  }

  return output;
}

function toJsonValue(propertyName: string, value: unknown): JsonValue {
  if (isJsonValue(value)) {
    return value;
  }

  throw new Error(`Command input is not JSON serializable: --${propertyName}`);
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
