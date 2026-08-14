import type { JsonObject } from "@tooldeck/protocol";

import {
  ApplicationError,
  toApplicationError,
  type ApplicationErrorCode,
  type ApplicationErrorDetails,
  type ApplicationErrorSource,
} from "@/errors/error";

export type ApplicationCleanupFailureErrorDiagnostic = {
  source: ApplicationErrorSource;
  code: ApplicationErrorCode;
  message: string;
  details?: JsonObject;
};

type EmptyCleanupContext = Record<string, never>;

interface ApplicationCleanupStepRegistry {
  "application.dispose": {
    phase: "cleanup";
    context: EmptyCleanupContext;
  };
  "applicationResources.dispose": {
    phase: "cleanup";
    context: EmptyCleanupContext;
  };
  "runtime.dispose": {
    phase: "cleanup";
    context: EmptyCleanupContext;
  };
  "database.close": {
    phase: "cleanup";
    context: EmptyCleanupContext;
  };
  "databaseTransaction.rollback": {
    phase: "rollback";
    context: EmptyCleanupContext;
  };
  "pluginStaging.remove": {
    phase: "cleanup";
    context: { stagingEntry: string; pluginId?: string };
  };
  "pluginInstall.delete": {
    phase: "rollback";
    context: { pluginId: string };
  };
  "pluginDirectory.remove": {
    phase: "rollback";
    context: { pluginId: string };
  };
  "pluginCatalog.restore": {
    phase: "rollback";
    context: { pluginId: string };
  };
  "pluginDirectory.restore": {
    phase: "rollback";
    context: { pluginId: string; stagingEntry: string };
  };
  "pluginInstall.restore": {
    phase: "rollback";
    context: { pluginId: string };
  };
  "pluginQuarantine.remove": {
    phase: "cleanup";
    context: { pluginId: string; stagingEntry: string };
  };
}

export interface MappedRuntimeCleanupStepRegistry {
  "subscription.dispose": { pluginId: string };
  "subscriptions.dispose": { pluginId: string };
  "plugin.deactivate": { pluginId: string };
  "plugin.dispose": { pluginId: string };
  "host.dispose": { runtimeKind: string };
}

export type ApplicationCleanupStep = keyof ApplicationCleanupStepRegistry;
export type ApplicationMappedRuntimeCleanupStep = keyof MappedRuntimeCleanupStepRegistry;

type ApplicationOwnedCleanupFailureDiagnostic = {
  [Step in ApplicationCleanupStep]: {
    phase: ApplicationCleanupStepRegistry[Step]["phase"];
    step: Step;
    context: ApplicationCleanupStepRegistry[Step]["context"];
    error: ApplicationCleanupFailureErrorDiagnostic;
  };
}[ApplicationCleanupStep];

type ApplicationMappedRuntimeCleanupFailureDiagnostic = {
  [Step in ApplicationMappedRuntimeCleanupStep]: {
    phase: "cleanup";
    step: Step;
    context: MappedRuntimeCleanupStepRegistry[Step];
    error: ApplicationCleanupFailureErrorDiagnostic;
  };
}[ApplicationMappedRuntimeCleanupStep];

export type ApplicationCleanupFailureDiagnostic =
  | ApplicationOwnedCleanupFailureDiagnostic
  | ApplicationMappedRuntimeCleanupFailureDiagnostic;

export interface CapturedApplicationCleanupFailure {
  diagnostic: ApplicationCleanupFailureDiagnostic;
  rawError: unknown;
}

export function captureApplicationCleanupFailure<Step extends ApplicationCleanupStep>(options: {
  phase: ApplicationCleanupStepRegistry[Step]["phase"];
  step: Step;
  context: ApplicationCleanupStepRegistry[Step]["context"];
  error: unknown;
}): CapturedApplicationCleanupFailure {
  return {
    diagnostic: {
      phase: options.phase,
      step: options.step,
      context: options.context,
      error: toApplicationCleanupFailureErrorDiagnostic(options.error),
    } as ApplicationCleanupFailureDiagnostic,
    rawError: options.error,
  };
}

export function combinePrimaryAndCleanupFailures(
  primaryError: unknown,
  cleanupFailures: readonly CapturedApplicationCleanupFailure[],
  aggregateMessage: string,
): ApplicationError {
  const primaryApplicationError = toApplicationError(primaryError);

  if (cleanupFailures.length === 0) {
    return primaryApplicationError;
  }

  return new ApplicationError({
    source: primaryApplicationError.source,
    code: primaryApplicationError.code,
    message: primaryApplicationError.message,
    cause: new AggregateError(
      [primaryApplicationError, ...cleanupFailures.map((failure) => failure.rawError)],
      aggregateMessage,
      { cause: primaryApplicationError },
    ),
    details: appendApplicationCleanupFailures(
      primaryApplicationError.details,
      cleanupFailures.map((failure) => failure.diagnostic),
    ),
  });
}

export function createApplicationCleanupError(
  message: string,
  cleanupFailures: readonly CapturedApplicationCleanupFailure[],
): ApplicationError {
  if (cleanupFailures.length === 0) {
    throw new Error("An Application cleanup error requires at least one cleanup failure.");
  }

  return new ApplicationError({
    source: "application",
    code: "ERR_UNKNOWN",
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

function toApplicationCleanupFailureErrorDiagnostic(
  error: unknown,
): ApplicationCleanupFailureErrorDiagnostic {
  const applicationError = toApplicationError(error);

  return {
    source: applicationError.source,
    code: applicationError.code,
    message: applicationError.message,
    ...(applicationError.details ? { details: applicationError.details } : {}),
  };
}

function appendApplicationCleanupFailures(
  details: ApplicationErrorDetails | undefined,
  cleanupFailures: ApplicationCleanupFailureDiagnostic[],
): ApplicationErrorDetails {
  return {
    ...details,
    cleanupFailures: [...(details?.cleanupFailures ?? []), ...cleanupFailures],
  };
}
