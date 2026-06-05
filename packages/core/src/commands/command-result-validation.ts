import type {
  CommandError,
  CommandResult,
  ContentBlock,
  TooldeckJsonSchema,
} from "@tooldeck/protocol";
import { TooldeckError, type JsonObject, type JsonValue } from "@tooldeck/shared";
import Ajv, { type ErrorObject } from "ajv";

const outputSchemaAjv = new Ajv({
  allErrors: true,
  strict: false,
});

export function validateCommandResult(options: {
  commandId: string;
  result: unknown;
}): CommandResult {
  const { commandId, result } = options;

  if (!isRecord(result)) {
    throwInvalidCommandResult({
      commandId,
      propertyPath: "",
      expected: "object",
      actual: describeActualValue(result),
    });
  }

  if (result.status !== "success" && result.status !== "error") {
    throwInvalidCommandResult({
      commandId,
      propertyPath: "status",
      expected: "success | error",
      actual: describeActualValue(result.status),
    });
  }

  if (!Array.isArray(result.blocks)) {
    throwInvalidCommandResult({
      commandId,
      propertyPath: "blocks",
      expected: "array",
      actual: describeActualValue(result.blocks),
    });
  }

  const blocks = result.blocks.map((block, index) =>
    validateContentBlock({
      commandId,
      block,
      propertyPath: `blocks[${index}]`,
    }),
  );
  const validated: CommandResult = {
    status: result.status,
    blocks,
  };

  if (result.error !== undefined) {
    validated.error = validateCommandError({
      commandId,
      error: result.error,
      propertyPath: "error",
    });
  }

  return validated;
}

export function validateCommandOutputSchema(options: {
  commandId: string;
  outputSchema?: TooldeckJsonSchema;
  result: CommandResult;
}): void {
  if (!options.outputSchema) {
    return;
  }

  const validate = outputSchemaAjv.compile(options.outputSchema);

  if (validate(options.result)) {
    return;
  }

  throwOutputSchemaError({
    commandId: options.commandId,
    error: validate.errors?.[0],
  });
}

function validateContentBlock(options: {
  commandId: string;
  block: unknown;
  propertyPath: string;
}): ContentBlock {
  if (!isRecord(options.block)) {
    throwInvalidCommandResult({
      commandId: options.commandId,
      propertyPath: options.propertyPath,
      expected: "object",
      actual: describeActualValue(options.block),
    });
  }

  if (
    options.block.type !== "text" &&
    options.block.type !== "code" &&
    options.block.type !== "json"
  ) {
    throwInvalidCommandResult({
      commandId: options.commandId,
      propertyPath: `${options.propertyPath}.type`,
      expected: "text | code | json",
      actual: describeActualValue(options.block.type),
    });
  }

  if (options.block.type === "json") {
    if (!isJsonValue(options.block.value)) {
      throwInvalidCommandResult({
        commandId: options.commandId,
        propertyPath: `${options.propertyPath}.value`,
        expected: "JSON value",
        actual: describeActualValue(options.block.value),
      });
    }

    return {
      type: "json",
      value: options.block.value,
    };
  }

  if (typeof options.block.text !== "string") {
    throwInvalidCommandResult({
      commandId: options.commandId,
      propertyPath: `${options.propertyPath}.text`,
      expected: "string",
      actual: describeActualValue(options.block.text),
    });
  }

  if (options.block.type === "code") {
    if (options.block.language !== undefined && typeof options.block.language !== "string") {
      throwInvalidCommandResult({
        commandId: options.commandId,
        propertyPath: `${options.propertyPath}.language`,
        expected: "string",
        actual: describeActualValue(options.block.language),
      });
    }

    return {
      type: "code",
      text: options.block.text,
      ...(options.block.language === undefined ? {} : { language: options.block.language }),
    };
  }

  return {
    type: "text",
    text: options.block.text,
  };
}

function validateCommandError(options: {
  commandId: string;
  error: unknown;
  propertyPath: string;
}): CommandError {
  if (!isRecord(options.error)) {
    throwInvalidCommandResult({
      commandId: options.commandId,
      propertyPath: options.propertyPath,
      expected: "object",
      actual: describeActualValue(options.error),
    });
  }

  if (typeof options.error.message !== "string") {
    throwInvalidCommandResult({
      commandId: options.commandId,
      propertyPath: `${options.propertyPath}.message`,
      expected: "string",
      actual: describeActualValue(options.error.message),
    });
  }

  const error: CommandError = {
    message: options.error.message,
  };

  if (options.error.code !== undefined) {
    if (typeof options.error.code !== "string") {
      throwInvalidCommandResult({
        commandId: options.commandId,
        propertyPath: `${options.propertyPath}.code`,
        expected: "string",
        actual: describeActualValue(options.error.code),
      });
    }

    error.code = options.error.code;
  }

  if (options.error.metadata !== undefined) {
    if (!isJsonObject(options.error.metadata)) {
      throwInvalidCommandResult({
        commandId: options.commandId,
        propertyPath: `${options.propertyPath}.metadata`,
        expected: "JSON object",
        actual: describeActualValue(options.error.metadata),
      });
    }

    error.metadata = options.error.metadata;
  }

  return error;
}

function throwInvalidCommandResult(options: {
  commandId: string;
  propertyPath: string;
  expected: JsonValue;
  actual: JsonValue;
}): never {
  throw new TooldeckError({
    code: "ERR_COMMAND_FAILED",
    message: `Invalid command result for ${options.commandId}: ${formatPropertyForMessage(options.propertyPath)}`,
    details: {
      issue: "invalid_command_result",
      commandId: options.commandId,
      propertyPath: options.propertyPath,
      expected: options.expected,
      actual: options.actual,
    },
  });
}

function throwOutputSchemaError(options: { commandId: string; error?: ErrorObject }): never {
  const propertyPath = options.error ? jsonPointerToPropertyPath(options.error.instancePath) : "";

  throw new TooldeckError({
    code: "ERR_COMMAND_FAILED",
    message: `Command output does not match outputSchema for ${options.commandId}: ${formatPropertyForMessage(propertyPath)}`,
    details: {
      issue: "invalid_command_output",
      commandId: options.commandId,
      propertyPath,
      schemaKeyword: options.error?.keyword ?? null,
      expected: readExpectedValue(options.error) ?? null,
      actual: options.error ? jsonValueOrDescription(options.error.data) : null,
    },
  });
}

function readExpectedValue(error: ErrorObject | undefined): JsonValue | JsonValue[] | undefined {
  if (!error) {
    return undefined;
  }

  if (error.keyword === "required") {
    const missingProperty = (error.params as Record<string, unknown>).missingProperty;

    return typeof missingProperty === "string" ? missingProperty : undefined;
  }

  if (error.keyword === "additionalProperties") {
    const additionalProperty = (error.params as Record<string, unknown>).additionalProperty;

    return typeof additionalProperty === "string" ? additionalProperty : undefined;
  }

  if (error.keyword === "type") {
    const expectedType = (error.params as Record<string, unknown>).type;

    return typeof expectedType === "string" ? expectedType : undefined;
  }

  if (error.keyword === "enum" && Array.isArray(error.schema)) {
    return error.schema.filter(isJsonValue);
  }

  if (isJsonValue(error.schema)) {
    return error.schema;
  }

  return undefined;
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

function jsonValueOrDescription(value: unknown): JsonValue {
  return isJsonValue(value) ? value : describeActualValue(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
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

  return isJsonObject(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
