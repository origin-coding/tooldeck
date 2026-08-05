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
