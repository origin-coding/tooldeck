import { Effect, Exit } from "effect";

import { applicationErrorFromCause, type ApplicationEffect } from "@/application/effect";
import type { CapturedApplicationCleanupFailure } from "@/errors/cleanup";

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
