import type { JsonObject } from "@tooldeck/protocol";

import { ApplicationError, toApplicationError } from "@/errors/application-error";
import { toApplicationErrorTransport } from "@/errors/application-error-transport";

export function combinePrimaryAndCleanupErrors(
  primaryError: unknown,
  cleanupErrors: readonly unknown[],
  aggregateMessage: string,
): ApplicationError {
  const primaryApplicationError = toApplicationError(primaryError);

  if (cleanupErrors.length === 0) {
    return primaryApplicationError;
  }

  const cleanupFailures = cleanupErrors.map(toCleanupFailure);

  return new ApplicationError({
    source: primaryApplicationError.source,
    code: primaryApplicationError.code,
    message: primaryApplicationError.message,
    cause: new AggregateError([primaryError, ...cleanupErrors], aggregateMessage, {
      cause: primaryError,
    }),
    details: {
      ...primaryApplicationError.details,
      ...(cleanupFailures.length === 1
        ? { cleanupFailure: cleanupFailures[0] }
        : { cleanupFailures }),
    },
  });
}

function toCleanupFailure(error: unknown): JsonObject {
  const transport = toApplicationErrorTransport(error);

  return {
    tag: transport.tag,
    source: transport.source,
    code: transport.code,
    message: transport.message,
    ...(transport.details ? { details: transport.details } : {}),
  };
}
