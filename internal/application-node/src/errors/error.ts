import type { JsonObject } from "@tooldeck/protocol";
import {
  isRuntimeError,
  type RuntimeCleanupFailureDiagnostic,
  type RuntimeErrorDetails,
} from "@tooldeck/runtime-node";

import type {
  ApplicationCleanupFailureDiagnostic,
  ApplicationCleanupFailureErrorDiagnostic,
} from "@/errors/cleanup";

export type ApplicationErrorSource = "application" | "runtime";

export type ApplicationErrorCode =
  | "ERR_UNKNOWN"
  | "ERR_INVALID_ARGUMENT"
  | "ERR_NOT_FOUND"
  | "ERR_ALREADY_EXISTS"
  | "ERR_NOT_IMPLEMENTED"
  | "ERR_APPLICATION_NOT_STARTED"
  | "ERR_APPLICATION_DISPOSED"
  | "ERR_PLUGIN_DISABLED"
  | "ERR_PLUGIN_LOAD_FAILED"
  | "ERR_COMMAND_NOT_FOUND"
  | "ERR_COMMAND_FAILED"
  | "ERR_RUNTIME_HOST_UNAVAILABLE";

export interface ApplicationErrorOptions {
  source: ApplicationErrorSource;
  code: ApplicationErrorCode;
  message: string;
  cause?: unknown;
  details?: ApplicationErrorDetails;
}

export type ApplicationErrorDetails = JsonObject & {
  cleanupFailures?: ApplicationCleanupFailureDiagnostic[];
};

const applicationErrorCodes = new Set<ApplicationErrorCode>([
  "ERR_UNKNOWN",
  "ERR_INVALID_ARGUMENT",
  "ERR_NOT_FOUND",
  "ERR_ALREADY_EXISTS",
  "ERR_NOT_IMPLEMENTED",
  "ERR_APPLICATION_NOT_STARTED",
  "ERR_APPLICATION_DISPOSED",
  "ERR_PLUGIN_DISABLED",
  "ERR_PLUGIN_LOAD_FAILED",
  "ERR_COMMAND_NOT_FOUND",
  "ERR_COMMAND_FAILED",
  "ERR_RUNTIME_HOST_UNAVAILABLE",
]);

const applicationErrorSources = new Set<ApplicationErrorSource>(["application", "runtime"]);

export class ApplicationError extends Error {
  readonly _tag = "ApplicationError";
  readonly source: ApplicationErrorSource;
  readonly code: ApplicationErrorCode;
  readonly details?: ApplicationErrorDetails;

  constructor(options: ApplicationErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ApplicationError";
    this.source = options.source;
    this.code = options.code;
    this.details = options.details;
  }
}

export function isApplicationError(
  error: unknown,
  code?: ApplicationErrorCode,
): error is ApplicationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "ApplicationError" &&
    "name" in error &&
    error.name === "ApplicationError" &&
    "message" in error &&
    typeof error.message === "string" &&
    "source" in error &&
    typeof error.source === "string" &&
    applicationErrorSources.has(error.source as ApplicationErrorSource) &&
    "code" in error &&
    typeof error.code === "string" &&
    applicationErrorCodes.has(error.code as ApplicationErrorCode) &&
    (code === undefined || error.code === code)
  );
}

export function toApplicationError(error: unknown): ApplicationError {
  if (isApplicationError(error)) {
    return error;
  }

  if (isRuntimeError(error)) {
    return fromRuntimeError(error);
  }

  if (error instanceof Error) {
    return new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: error.message,
      cause: error,
    });
  }

  return new ApplicationError({
    source: "application",
    code: "ERR_UNKNOWN",
    message: String(error),
    details: {
      thrown: String(error),
    },
  });
}

export function fromRuntimeError(error: unknown): ApplicationError {
  if (!isRuntimeError(error)) {
    return toApplicationError(error);
  }

  return new ApplicationError({
    source: "runtime",
    code: error.code,
    message: error.message,
    cause: error,
    details: mapRuntimeErrorDetails(error.details),
  });
}

function mapRuntimeErrorDetails(
  details: RuntimeErrorDetails | undefined,
): ApplicationErrorDetails | undefined {
  if (!details) {
    return undefined;
  }

  return {
    ...details,
    ...(details.cleanupFailures
      ? { cleanupFailures: details.cleanupFailures.map(mapRuntimeCleanupFailureDiagnostic) }
      : {}),
  };
}

function mapRuntimeCleanupFailureDiagnostic(
  diagnostic: RuntimeCleanupFailureDiagnostic,
): ApplicationCleanupFailureDiagnostic {
  const error = mapRuntimeCleanupFailureErrorDiagnostic(diagnostic.error);

  switch (diagnostic.step) {
    case "subscription.dispose":
      return { ...diagnostic, context: { pluginId: diagnostic.context.pluginId }, error };
    case "subscriptions.dispose":
      return { ...diagnostic, context: { pluginId: diagnostic.context.pluginId }, error };
    case "plugin.deactivate":
      return { ...diagnostic, context: { pluginId: diagnostic.context.pluginId }, error };
    case "plugin.dispose":
      return { ...diagnostic, context: { pluginId: diagnostic.context.pluginId }, error };
    case "host.dispose":
      return { ...diagnostic, context: { runtimeKind: diagnostic.context.runtimeKind }, error };
  }
}

function mapRuntimeCleanupFailureErrorDiagnostic(
  diagnostic: RuntimeCleanupFailureDiagnostic["error"],
): ApplicationCleanupFailureErrorDiagnostic {
  return {
    source: "runtime",
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.details ? { details: mapNestedRuntimeCleanupDetails(diagnostic.details) } : {}),
  };
}

function mapNestedRuntimeCleanupDetails(details: JsonObject): JsonObject {
  const runtimeDetails = details as RuntimeErrorDetails;

  return {
    ...details,
    ...(runtimeDetails.cleanupFailures
      ? { cleanupFailures: runtimeDetails.cleanupFailures.map(mapRuntimeCleanupFailureDiagnostic) }
      : {}),
  };
}
