import type { JsonObject, JsonValue } from "@tooldeck/protocol";

import { describeValue, formatPath } from "./validation-values";

export class JsonValueValidationError extends TypeError {
  readonly propertyPath: string;
  readonly actual: string;
  readonly value: unknown;

  constructor(propertyPath: string, value: unknown) {
    super(`Invalid JSON value at ${formatPath(propertyPath)}: ${describeValue(value)}.`);
    this.name = "JsonValueValidationError";
    this.propertyPath = propertyPath;
    this.actual = describeValue(value);
    this.value = value;
  }
}

export function normalizeJsonValue(value: unknown, propertyPath = ""): JsonValue {
  return normalizeJsonValueInner(value, propertyPath, new WeakSet<object>());
}

function normalizeJsonValueInner(
  value: unknown,
  propertyPath: string,
  ancestors: WeakSet<object>,
): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new JsonValueValidationError(propertyPath, value);
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new JsonValueValidationError(propertyPath, value);
  }

  if (ancestors.has(value)) {
    throw new JsonValueValidationError(propertyPath, value);
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        normalizeJsonValueInner(item, `${propertyPath}[${index}]`, ancestors),
      );
    }

    const prototype = Object.getPrototypeOf(value);

    if (prototype !== Object.prototype && prototype !== null) {
      throw new JsonValueValidationError(propertyPath, value);
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new JsonValueValidationError(propertyPath, value);
    }

    const output: JsonObject = {};

    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (!descriptor || !("value" in descriptor)) {
        throw new JsonValueValidationError(appendProperty(propertyPath, key), value);
      }

      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: normalizeJsonValueInner(
          descriptor.value,
          appendProperty(propertyPath, key),
          ancestors,
        ),
      });
    }

    return output;
  } finally {
    ancestors.delete(value);
  }
}

function appendProperty(parentPath: string, propertyName: string): string {
  return parentPath ? `${parentPath}.${propertyName}` : propertyName;
}
