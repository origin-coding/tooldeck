import type { JsonObject } from "@tooldeck/protocol";

export interface DesktopApiError {
  tag: "ApplicationError";
  source: "application" | "runtime";
  code: string;
  message: string;
  details?: JsonObject;
}

export function isDesktopApiError(value: unknown): value is DesktopApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "tag" in value &&
    value.tag === "ApplicationError" &&
    "message" in value &&
    typeof value.message === "string"
  );
}
