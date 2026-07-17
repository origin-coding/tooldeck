import type {
  CommandError,
  CommandResult,
  ContentBlock,
  JsonObject,
  JsonValue,
  LocalizedString,
  PropertyItem,
  PropertyValue,
} from "@tooldeck/protocol";

import { JsonValueValidationError, normalizeJsonValue } from "./json-value-validation";
import { describeValue, formatPath, isRecord } from "./validation-values";

export class CommandResultValidationError extends TypeError {
  readonly commandId: string;
  readonly propertyPath: string;
  readonly expected: string;
  readonly actual: string;

  constructor(options: {
    commandId: string;
    propertyPath: string;
    expected: string;
    actual: string;
  }) {
    super(
      `Invalid command result for ${options.commandId}: ${formatPath(options.propertyPath)} expected ${options.expected}, received ${options.actual}.`,
    );
    this.name = "CommandResultValidationError";
    this.commandId = options.commandId;
    this.propertyPath = options.propertyPath;
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

export function normalizeCommandResult(options: {
  commandId: string;
  result: unknown;
}): CommandResult {
  const { commandId, result } = options;

  if (!isRecord(result)) {
    throwValidationError(commandId, "", "object", result);
  }

  if (result.status !== "success" && result.status !== "error") {
    throwValidationError(commandId, "status", "success | error", result.status);
  }

  if (!Array.isArray(result.blocks)) {
    throwValidationError(commandId, "blocks", "array", result.blocks);
  }

  return {
    status: result.status,
    blocks: result.blocks.map((block, index) =>
      normalizeContentBlock(commandId, block, `blocks[${index}]`),
    ),
    ...(result.error === undefined
      ? {}
      : { error: normalizeCommandError(commandId, result.error, "error") }),
  };
}

function normalizeContentBlock(
  commandId: string,
  block: unknown,
  propertyPath: string,
): ContentBlock {
  if (!isRecord(block)) {
    throwValidationError(commandId, propertyPath, "object", block);
  }

  if (block.type === "text") {
    if (typeof block.text !== "string") {
      throwValidationError(commandId, `${propertyPath}.text`, "string", block.text);
    }

    return { type: "text", text: block.text };
  }

  if (block.type === "code") {
    if (typeof block.text !== "string") {
      throwValidationError(commandId, `${propertyPath}.text`, "string", block.text);
    }

    if (block.language !== undefined && typeof block.language !== "string") {
      throwValidationError(commandId, `${propertyPath}.language`, "string", block.language);
    }

    return {
      type: "code",
      text: block.text,
      ...(block.language === undefined ? {} : { language: block.language }),
    };
  }

  if (block.type === "json") {
    return {
      type: "json",
      value: normalizeJsonValueForCommand(commandId, block.value, `${propertyPath}.value`),
    };
  }

  if (block.type === "properties") {
    if (!Array.isArray(block.items)) {
      throwValidationError(commandId, `${propertyPath}.items`, "array", block.items);
    }

    return {
      type: "properties",
      items: block.items.map((item, index) =>
        normalizePropertyItem(commandId, item, `${propertyPath}.items[${index}]`),
      ),
    };
  }

  throwValidationError(
    commandId,
    `${propertyPath}.type`,
    "text | code | json | properties",
    block.type,
  );
}

function normalizePropertyItem(
  commandId: string,
  item: unknown,
  propertyPath: string,
): PropertyItem {
  if (!isRecord(item)) {
    throwValidationError(commandId, propertyPath, "object", item);
  }

  const label = normalizeLocalizedString(commandId, item.label, `${propertyPath}.label`);
  const value = normalizePropertyValue(commandId, item.value, `${propertyPath}.value`);
  const note =
    item.note === undefined
      ? undefined
      : normalizeLocalizedString(commandId, item.note, `${propertyPath}.note`);

  return {
    label,
    value,
    ...(note === undefined ? {} : { note }),
  };
}

function normalizeLocalizedString(
  commandId: string,
  value: unknown,
  propertyPath: string,
): LocalizedString {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value)) {
    throwValidationError(commandId, propertyPath, "LocalizedString", value);
  }

  if (typeof value.key !== "string") {
    throwValidationError(commandId, `${propertyPath}.key`, "string", value.key);
  }

  if (typeof value.default !== "string") {
    throwValidationError(commandId, `${propertyPath}.default`, "string", value.default);
  }

  return {
    key: value.key,
    default: value.default,
  };
}

function normalizePropertyValue(
  commandId: string,
  value: unknown,
  propertyPath: string,
): PropertyValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }

  throwValidationError(commandId, propertyPath, "string | finite number | boolean | null", value);
}

function normalizeCommandError(
  commandId: string,
  value: unknown,
  propertyPath: string,
): CommandError {
  if (!isRecord(value)) {
    throwValidationError(commandId, propertyPath, "object", value);
  }

  if (typeof value.message !== "string") {
    throwValidationError(commandId, `${propertyPath}.message`, "string", value.message);
  }

  if (value.code !== undefined && typeof value.code !== "string") {
    throwValidationError(commandId, `${propertyPath}.code`, "string", value.code);
  }

  const metadata =
    value.metadata === undefined
      ? undefined
      : normalizeJsonObjectForCommand(commandId, value.metadata, `${propertyPath}.metadata`);

  return {
    message: value.message,
    ...(value.code === undefined ? {} : { code: value.code }),
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function normalizeJsonObjectForCommand(
  commandId: string,
  value: unknown,
  propertyPath: string,
): JsonObject {
  const normalized = normalizeJsonValueForCommand(commandId, value, propertyPath);

  if (!isRecord(normalized)) {
    throwValidationError(commandId, propertyPath, "JSON object", value);
  }

  return normalized;
}

function normalizeJsonValueForCommand(
  commandId: string,
  value: unknown,
  propertyPath: string,
): JsonValue {
  try {
    return normalizeJsonValue(value, propertyPath);
  } catch (error) {
    if (error instanceof JsonValueValidationError) {
      throw new CommandResultValidationError({
        commandId,
        propertyPath: error.propertyPath,
        expected: "JSON value",
        actual: error.actual,
      });
    }

    throw error;
  }
}

function throwValidationError(
  commandId: string,
  propertyPath: string,
  expected: string,
  value: unknown,
): never {
  throw new CommandResultValidationError({
    commandId,
    propertyPath,
    expected,
    actual: describeValue(value),
  });
}
