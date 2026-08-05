import type { JsonObject } from "@tooldeck/protocol";

import {
  RuntimeError,
  toRuntimeError,
  type RuntimeErrorCode,
  type RuntimeErrorDetails,
} from "@/errors/runtime-error";

export type RuntimeCleanupFailureErrorDiagnostic = {
  source: "runtime";
  code: RuntimeErrorCode;
  message: string;
  details?: JsonObject;
};

interface RuntimeCleanupStepContextRegistry {
  "subscription.dispose": { pluginId: string };
  "subscriptions.dispose": { pluginId: string };
  "plugin.deactivate": { pluginId: string };
  "plugin.dispose": { pluginId: string };
  "host.dispose": { runtimeKind: string };
}

export type RuntimeCleanupStep = keyof RuntimeCleanupStepContextRegistry;

export type RuntimeCleanupFailureDiagnostic = {
  [Step in RuntimeCleanupStep]: {
    phase: "cleanup";
    step: Step;
    context: RuntimeCleanupStepContextRegistry[Step];
    error: RuntimeCleanupFailureErrorDiagnostic;
  };
}[RuntimeCleanupStep];

export interface CapturedRuntimeCleanupFailure {
  diagnostic: RuntimeCleanupFailureDiagnostic;
  rawError: unknown;
}

export function captureRuntimeCleanupFailure<Step extends RuntimeCleanupStep>(options: {
  step: Step;
  context: RuntimeCleanupStepContextRegistry[Step];
  error: unknown;
}): CapturedRuntimeCleanupFailure {
  return {
    diagnostic: {
      phase: "cleanup",
      step: options.step,
      context: options.context,
      error: toRuntimeCleanupFailureErrorDiagnostic(options.error),
    } as RuntimeCleanupFailureDiagnostic,
    rawError: options.error,
  };
}

export function combineRuntimePrimaryAndCleanupFailures(
  primaryError: unknown,
  cleanupFailures: readonly CapturedRuntimeCleanupFailure[],
  aggregateMessage: string,
): RuntimeError {
  const primaryRuntimeError = toRuntimeError(primaryError);

  if (cleanupFailures.length === 0) {
    return primaryRuntimeError;
  }

  return new RuntimeError({
    code: primaryRuntimeError.code,
    message: primaryRuntimeError.message,
    cause: new AggregateError(
      [primaryRuntimeError, ...cleanupFailures.map((failure) => failure.rawError)],
      aggregateMessage,
      { cause: primaryRuntimeError },
    ),
    details: appendRuntimeCleanupFailures(
      primaryRuntimeError.details,
      cleanupFailures.map((failure) => failure.diagnostic),
    ),
  });
}

export function createRuntimeCleanupError(
  message: string,
  cleanupFailures: readonly CapturedRuntimeCleanupFailure[],
): RuntimeError {
  if (cleanupFailures.length === 0) {
    throw new Error("A Runtime cleanup error requires at least one cleanup failure.");
  }

  return new RuntimeError({
    code: "ERR_PLUGIN_LOAD_FAILED",
    message,
    cause: new AggregateError(
      cleanupFailures.map((failure) => failure.rawError),
      message,
    ),
    details: {
      cleanupFailures: cleanupFailures.map((failure) => failure.diagnostic),
    },
  });
}

export function mapRuntimeCleanupFailureDiagnostic(
  diagnostic: RuntimeCleanupFailureDiagnostic,
): RuntimeCleanupFailureDiagnostic {
  switch (diagnostic.step) {
    case "subscription.dispose":
    case "subscriptions.dispose":
    case "plugin.deactivate":
    case "plugin.dispose":
    case "host.dispose":
      return diagnostic;
  }
}

function toRuntimeCleanupFailureErrorDiagnostic(
  error: unknown,
): RuntimeCleanupFailureErrorDiagnostic {
  const runtimeError = toRuntimeError(error);

  return {
    source: "runtime",
    code: runtimeError.code,
    message: runtimeError.message,
    ...(runtimeError.details ? { details: runtimeError.details } : {}),
  };
}

function appendRuntimeCleanupFailures(
  details: RuntimeErrorDetails | undefined,
  cleanupFailures: RuntimeCleanupFailureDiagnostic[],
): RuntimeErrorDetails {
  return {
    ...details,
    cleanupFailures: [...(details?.cleanupFailures ?? []), ...cleanupFailures],
  };
}
