import type { TooldeckJsonSchema } from "@tooldeck/protocol";
import { JsonValueValidationError, normalizeJsonValue } from "@tooldeck/sdk-node";
import type { JsonObject, JsonValue } from "@tooldeck/shared";
import Ajv from "ajv";

import {
  throwAjvCommandInputError,
  throwExpectedTypeError,
  throwNotJsonSerializableError,
} from "./command-input-errors";
import type { CommandInputCoercion, CommandInputContext } from "./command-input-types";

const strictAjv = createAjv(false);
const cliAjv = createAjv(true);

export function normalizeInputWithSchema(options: {
  input: Record<string, unknown>;
  inputSchema: TooldeckJsonSchema;
  commandId?: string;
  coercion: CommandInputCoercion;
}): JsonObject {
  const context: CommandInputContext = {
    commandId: options.commandId,
    coercion: options.coercion,
  };
  const schema = normalizeSchemaForAjv(options.inputSchema);
  const input = cloneJsonValue("", options.input, context);
  const validate = getAjv(options.coercion).compile(schema);

  if (!validate(input)) {
    throwAjvCommandInputError({
      errors: validate.errors ?? [],
      context,
    });
  }

  if (!isJsonObject(input)) {
    throwExpectedTypeError("", "object", input, context);
  }

  return input;
}

export function toJsonObject(input: Record<string, unknown>): JsonObject {
  const context: CommandInputContext = {
    coercion: "none",
  };
  const cloned = cloneJsonValue("", input, context);

  if (!isJsonObject(cloned)) {
    throwExpectedTypeError("", "object", cloned, context);
  }

  return cloned;
}

function createAjv(coerceTypes: boolean): Ajv {
  return new Ajv({
    allErrors: true,
    coerceTypes,
    strict: false,
    strictNumbers: true,
    useDefaults: true,
  });
}

function getAjv(coercion: CommandInputCoercion): Ajv {
  return coercion === "cli" ? cliAjv : strictAjv;
}

function cloneJsonValue(
  propertyPath: string,
  value: unknown,
  context: CommandInputContext,
): JsonValue {
  try {
    return normalizeJsonValue(value, propertyPath);
  } catch (error) {
    if (error instanceof JsonValueValidationError) {
      throwNotJsonSerializableError(error.propertyPath, error.value, context);
    }

    throw error;
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSchemaForAjv(schema: TooldeckJsonSchema): TooldeckJsonSchema {
  return normalizeSchemaNode(schema);
}

function normalizeSchemaNode(schema: unknown): TooldeckJsonSchema {
  if (!isSchemaObject(schema)) {
    return {};
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "properties" && isRecord(value)) {
      normalized[key] = Object.fromEntries(
        Object.entries(value).map(([propertyName, propertySchema]) => [
          propertyName,
          normalizeSchemaNode(propertySchema),
        ]),
      );
      continue;
    }

    if (key === "items" && isSchemaObject(value)) {
      normalized[key] = normalizeSchemaNode(value);
      continue;
    }

    if (key === "additionalProperties" && isSchemaObject(value)) {
      normalized[key] = normalizeSchemaNode(value);
      continue;
    }

    if (key === "allOf" && Array.isArray(value)) {
      normalized[key] = value.map((item) => normalizeSchemaNode(item));
      continue;
    }

    // oneOf and anyOf are intentionally not supported by command input
    // normalization yet because branch selection affects default/coercion output.

    normalized[key] = value;
  }

  if (
    normalized.type === undefined &&
    (normalized.properties !== undefined ||
      normalized.required !== undefined ||
      normalized.additionalProperties !== undefined)
  ) {
    normalized.type = "object";
  }

  if (
    normalized.type === undefined &&
    (normalized.items !== undefined ||
      normalized.minItems !== undefined ||
      normalized.maxItems !== undefined ||
      normalized.uniqueItems !== undefined)
  ) {
    normalized.type = "array";
  }

  return normalized as TooldeckJsonSchema;
}

function isSchemaObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
