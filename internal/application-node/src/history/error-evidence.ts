import type { JsonObject, JsonValue } from "@tooldeck/protocol";

export type ApplicationErrorEvidenceFormat = "canonical" | "legacy";

export function classifyApplicationErrorEvidence(error: JsonValue): ApplicationErrorEvidenceFormat {
  if (!isApplicationErrorTransportShape(error)) {
    return "legacy";
  }

  return containsLegacyCleanupShape(error.details) ? "legacy" : "canonical";
}

function isApplicationErrorTransportShape(value: JsonValue): value is JsonObject & {
  tag: "ApplicationError";
  source: "application" | "runtime";
  code: string;
  message: string;
  details?: JsonObject;
} {
  return (
    isJsonObject(value) &&
    value.tag === "ApplicationError" &&
    (value.source === "application" || value.source === "runtime") &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (value.details === undefined || isJsonObject(value.details))
  );
}

function containsLegacyCleanupShape(details: JsonObject | undefined): boolean {
  if (!details) {
    return false;
  }

  if ("cleanupError" in details || "cleanupFailure" in details || "rollbackErrors" in details) {
    return true;
  }

  if (Array.isArray(details.errors) && looksLikeLegacyCleanupErrors(details.errors)) {
    return true;
  }

  return Object.values(details).some((value) => {
    if (!isJsonObject(value)) {
      return false;
    }

    return containsLegacyCleanupShape(value);
  });
}

function looksLikeLegacyCleanupErrors(errors: JsonValue[]): boolean {
  return errors.some(
    (error) =>
      typeof error === "string" ||
      (isJsonObject(error) &&
        typeof error.code === "string" &&
        typeof error.message === "string" &&
        (typeof error.pluginId === "string" || typeof error.runtimeKind === "string")),
  );
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
