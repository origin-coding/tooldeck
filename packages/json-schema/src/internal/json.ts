import type { JsonObject, JsonValue } from "@tooldeck/protocol";

import type { JsonSchemaIssue, JsonSchemaValidationResult } from "../contracts";

/** @internal */
export function cloneJsonValue(value: unknown): JsonSchemaValidationResult<JsonValue> {
  return cloneAtPath(value, "", new WeakSet<object>());
}

/** @internal */
export function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @internal */
export function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

/** @internal */
export function appendJsonPointer(pointer: string, property: string): string {
  return `${pointer}/${escapeJsonPointer(property)}`;
}

/** @internal */
export function jsonPointerToPropertyPath(pointer: string): string {
  const parts = parseJsonPointer(pointer);

  if (!parts) {
    return "";
  }

  return parts.reduce((path, part) => appendPropertyPath(path, part), "");
}

/** @internal */
export function readJsonPointer(root: JsonValue, pointer: string): JsonValue | undefined {
  const parts = parseJsonPointer(pointer);

  if (!parts) {
    return undefined;
  }

  let current: JsonValue = root;

  for (const part of parts) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(part)) {
        return undefined;
      }

      const index = Number(part);

      if (index >= current.length) {
        return undefined;
      }

      current = current[index]!;
      continue;
    }

    if (isJsonObject(current) && Object.hasOwn(current, part)) {
      current = current[part]!;
      continue;
    }

    return undefined;
  }

  return current;
}

function cloneAtPath(
  value: unknown,
  instancePath: string,
  ancestors: WeakSet<object>,
): JsonSchemaValidationResult<JsonValue> {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { valid: true, value };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { valid: true, value }
      : invalidJsonValue(instancePath, describeValue(value));
  }

  if (typeof value !== "object") {
    return invalidJsonValue(instancePath, describeValue(value));
  }

  if (ancestors.has(value)) {
    return invalidJsonValue(instancePath, "circular reference");
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const cloned: JsonValue[] = [];

      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          return invalidJsonValue(`${instancePath}/${index}`, "sparse array item");
        }

        const item = cloneAtPath(value[index], `${instancePath}/${index}`, ancestors);

        if (!item.valid) {
          return item;
        }

        cloned.push(item.value);
      }

      return { valid: true, value: cloned };
    }

    if (!isPlainObject(value)) {
      return invalidJsonValue(instancePath, describeValue(value));
    }

    const cloned: JsonObject = {};

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        return invalidJsonValue(instancePath, "symbol property");
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (!descriptor?.enumerable || !("value" in descriptor)) {
        return invalidJsonValue(appendJsonPointer(instancePath, key), "non-data property");
      }

      const property = cloneAtPath(
        descriptor.value,
        appendJsonPointer(instancePath, key),
        ancestors,
      );

      if (!property.valid) {
        return property;
      }

      cloned[key] = property.value;
    }

    return { valid: true, value: cloned };
  } finally {
    ancestors.delete(value);
  }
}

function invalidJsonValue(
  instancePath: string,
  actual: string,
): JsonSchemaValidationResult<JsonValue> {
  const issue: JsonSchemaIssue = {
    code: "json-value.not-json-safe",
    instancePath,
    propertyPath: jsonPointerToPropertyPath(instancePath),
    keyword: "json",
    message: "Value must be JSON-safe",
    actual,
  };

  return {
    valid: false,
    error: {
      kind: "validation",
      code: "value_does_not_match_schema",
      message: "Value is not JSON-safe",
      issues: [issue],
    },
  };
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function describeValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "NaN";
    }

    return value > 0 ? "Infinity" : "-Infinity";
  }

  if (value instanceof Date) {
    return "Date";
  }

  if (value instanceof Map) {
    return "Map";
  }

  if (value instanceof Set) {
    return "Set";
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (typeof value === "object" && value !== null) {
    return value.constructor?.name || "object";
  }

  return typeof value;
}

function parseJsonPointer(pointer: string): string[] | undefined {
  if (pointer === "") {
    return [];
  }

  if (!pointer.startsWith("/")) {
    return undefined;
  }

  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function appendPropertyPath(path: string, property: string): string {
  if (/^(0|[1-9]\d*)$/.test(property)) {
    return `${path}[${property}]`;
  }

  if (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(property)) {
    return path ? `${path}.${property}` : property;
  }

  return `${path}[${JSON.stringify(property)}]`;
}
