import { isRuntimeError } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit } from "effect";

import type { ApplicationEffect, ApplicationFailure } from "@/application/effect";
import { tryApplicationPromise } from "@/application/effect";
import { ApplicationError, fromRuntimeError, isApplicationError } from "@/errors/application-error";

export async function runApplicationOperation<T>(operation: () => T | Promise<T>): Promise<T> {
  return runApplicationEffect(tryApplicationPromise(async () => operation()));
}

export async function runApplicationEffect<T>(effect: ApplicationEffect<T>): Promise<T> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw applicationErrorFromCause(exit.cause);
}

export function applicationErrorFromCause(
  cause: Cause.Cause<ApplicationFailure>,
): ApplicationError {
  const failures = Array.from(Cause.failures(cause));
  const defects = Array.from(Cause.defects(cause));
  const interrupted = Cause.isInterrupted(cause);

  if (failures.length > 0) {
    const primary = mapTypedFailure(failures[0]!);
    const secondaryCauses = [
      ...failures.slice(1).map(mapTypedFailure),
      ...defects,
      ...(interrupted ? [new ApplicationInterruptionDiagnostic()] : []),
    ];

    if (secondaryCauses.length === 0) {
      return primary;
    }

    return new ApplicationError({
      source: primary.source,
      code: primary.code,
      message: primary.message,
      details: primary.details,
      cause: new AggregateError(
        [primary, ...secondaryCauses],
        "Application operation failed with additional internal causes.",
        { cause: primary },
      ),
    });
  }

  if (defects.length > 0) {
    return new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation failed unexpectedly.",
      cause:
        defects.length === 1
          ? defects[0]
          : new AggregateError(defects, "Application operation failed with multiple defects."),
    });
  }

  if (interrupted) {
    return new ApplicationError({
      source: "application",
      code: "ERR_UNKNOWN",
      message: "Application operation was interrupted.",
      cause: new ApplicationInterruptionDiagnostic(),
    });
  }

  return new ApplicationError({
    source: "application",
    code: "ERR_UNKNOWN",
    message: "Application operation failed unexpectedly.",
  });
}

function mapTypedFailure(error: ApplicationFailure): ApplicationError {
  if (isApplicationError(error)) {
    return error;
  }

  if (isRuntimeError(error)) {
    return fromRuntimeError(error);
  }

  return new ApplicationError({
    source: "application",
    code: "ERR_UNKNOWN",
    message: "Application operation failed with an invalid typed failure.",
  });
}

class ApplicationInterruptionDiagnostic extends Error {
  constructor() {
    super("The internal Application Effect was interrupted.");
    this.name = "ApplicationInterruptionDiagnostic";
  }
}
