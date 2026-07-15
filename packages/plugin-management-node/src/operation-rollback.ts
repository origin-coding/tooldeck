import { TooldeckError } from "@tooldeck/shared";

export async function captureRollbackError(
  operation: () => unknown | Promise<unknown>,
  label: string,
  rollbackErrors: string[],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    rollbackErrors.push(`${label}: ${formatUnknownError(error)}`);
  }
}

export function throwOperationFailure(
  operation: string,
  error: unknown,
  rollbackErrors: string[],
): never {
  if (rollbackErrors.length === 0) {
    throw error;
  }

  throw new TooldeckError({
    code: "ERR_UNKNOWN",
    message: `${operation} failed and rollback did not complete: ${formatUnknownError(error)}`,
    cause: error,
    details: {
      rollbackErrors,
    },
  });
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
