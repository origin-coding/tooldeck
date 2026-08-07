import { Effect, Exit } from "effect";

import { applicationErrorFromCause } from "@/application/edge";
import type { ApplicationEffect } from "@/application/effect";
import {
  combinePrimaryAndCleanupFailures,
  type CapturedApplicationCleanupFailure,
} from "@/errors/application-cleanup";

export async function captureOperationFailure(
  operation: () => unknown | Promise<unknown>,
  cleanupFailures: CapturedApplicationCleanupFailure[],
  capture: (error: unknown) => CapturedApplicationCleanupFailure,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    cleanupFailures.push(capture(error));
  }
}

export function captureOperationFailureEffect(
  operation: ApplicationEffect<unknown>,
  cleanupFailures: CapturedApplicationCleanupFailure[],
  capture: (error: unknown) => CapturedApplicationCleanupFailure,
): ApplicationEffect<void> {
  return Effect.gen(function* () {
    const exit = yield* Effect.exit(operation);

    if (Exit.isFailure(exit)) {
      cleanupFailures.push(capture(applicationErrorFromCause(exit.cause)));
    }
  });
}

export function throwOperationFailure(
  operation: string,
  error: unknown,
  cleanupFailures: CapturedApplicationCleanupFailure[],
): never {
  if (cleanupFailures.length === 0) {
    throw error;
  }

  throw combinePrimaryAndCleanupFailures(
    error,
    cleanupFailures,
    `${operation} failed and cleanup or rollback did not complete.`,
  );
}
