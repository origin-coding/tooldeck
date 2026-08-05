import type { JsonObject } from "@tooldeck/protocol";

import type { RuntimeCleanupFailureDiagnostic } from "@/errors/runtime-cleanup";

export type RuntimeErrorCode =
  | "ERR_UNKNOWN"
  | "ERR_INVALID_ARGUMENT"
  | "ERR_NOT_FOUND"
  | "ERR_ALREADY_EXISTS"
  | "ERR_NOT_IMPLEMENTED"
  | "ERR_PLUGIN_LOAD_FAILED"
  | "ERR_COMMAND_NOT_FOUND"
  | "ERR_COMMAND_FAILED"
  | "ERR_RUNTIME_HOST_UNAVAILABLE";

export interface RuntimeErrorOptions {
  code: RuntimeErrorCode;
  message: string;
  cause?: unknown;
  details?: RuntimeErrorDetails;
}

export type RuntimeErrorDetails = JsonObject & {
  cleanupFailures?: RuntimeCleanupFailureDiagnostic[];
};

const runtimeErrorCodes = new Set<RuntimeErrorCode>([
  "ERR_UNKNOWN",
  "ERR_INVALID_ARGUMENT",
  "ERR_NOT_FOUND",
  "ERR_ALREADY_EXISTS",
  "ERR_NOT_IMPLEMENTED",
  "ERR_PLUGIN_LOAD_FAILED",
  "ERR_COMMAND_NOT_FOUND",
  "ERR_COMMAND_FAILED",
  "ERR_RUNTIME_HOST_UNAVAILABLE",
]);

export class RuntimeError extends Error {
  readonly _tag = "RuntimeError";
  readonly code: RuntimeErrorCode;
  readonly details?: RuntimeErrorDetails;

  constructor(options: RuntimeErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "RuntimeError";
    this.code = options.code;
    this.details = options.details;
  }
}

export function isRuntimeError(error: unknown): error is RuntimeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "RuntimeError" &&
    "name" in error &&
    error.name === "RuntimeError" &&
    "message" in error &&
    typeof error.message === "string" &&
    "code" in error &&
    typeof error.code === "string" &&
    runtimeErrorCodes.has(error.code as RuntimeErrorCode)
  );
}

export function toRuntimeError(error: unknown): RuntimeError {
  if (isRuntimeError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new RuntimeError({
      code: "ERR_UNKNOWN",
      message: error.message,
      cause: error,
    });
  }

  return new RuntimeError({
    code: "ERR_UNKNOWN",
    message: String(error),
    details: {
      thrown: String(error),
    },
  });
}
