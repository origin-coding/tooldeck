import path from "node:path";

import type { JsonObject, JsonValue } from "@tooldeck/protocol";
import { Schema } from "effect";

export const NonEmptyStringSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => "Expected a non-empty string" }),
);

export const AbsolutePathSchema = Schema.String.pipe(
  Schema.filter(path.isAbsolute, { message: () => "Expected an absolute path" }),
);

export const PositiveSafeIntegerSchema = Schema.Number.pipe(Schema.int(), Schema.positive());

export const JsonValueSchema = Schema.Unknown.pipe(
  Schema.filter((value): value is JsonValue => isJsonValue(value), {
    message: () => "Expected a JSON value",
  }),
);

export const JsonObjectSchema = Schema.Unknown.pipe(
  Schema.filter((value): value is JsonObject => isJsonObject(value), {
    message: () => "Expected a JSON object",
  }),
);

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every(isJsonValue)
  );
}
