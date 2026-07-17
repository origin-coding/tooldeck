import type { CommandResult, TooldeckJsonSchema } from "@tooldeck/protocol";
import { normalizeJsonValue } from "@tooldeck/sdk-node";
import { TooldeckError, type JsonValue } from "@tooldeck/shared";
import Ajv, { type ErrorObject } from "ajv";

const outputSchemaAjv = new Ajv({
  allErrors: true,
  strict: false,
  strictNumbers: true,
});

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
    return error.schema.flatMap((value) => {
      const normalized = tryNormalizeJsonValue(value);
      return normalized === undefined ? [] : [normalized];
    });
  }

  return tryNormalizeJsonValue(error.schema);
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
  return tryNormalizeJsonValue(value) ?? describeActualValue(value);
}

function tryNormalizeJsonValue(value: unknown): JsonValue | undefined {
  try {
    return normalizeJsonValue(value);
  } catch {
    return undefined;
  }
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
