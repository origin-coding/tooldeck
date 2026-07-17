import type { CommandResult } from "@tooldeck/protocol";
import { CommandResultValidationError, normalizeCommandResult } from "@tooldeck/sdk-node";
import { TooldeckError } from "@tooldeck/shared";

export function validateCommandResult(options: {
  commandId: string;
  result: unknown;
}): CommandResult {
  try {
    return normalizeCommandResult(options);
  } catch (error) {
    if (!(error instanceof CommandResultValidationError)) {
      throw error;
    }

    throw new TooldeckError({
      code: "ERR_COMMAND_FAILED",
      message: `Invalid command result for ${error.commandId}: ${formatPropertyForMessage(error.propertyPath)}`,
      cause: error,
      details: {
        issue: "invalid_command_result",
        commandId: error.commandId,
        propertyPath: error.propertyPath,
        expected: error.expected,
        actual: error.actual,
      },
    });
  }
}

function formatPropertyForMessage(propertyPath: string): string {
  return propertyPath ? `--${propertyPath}` : "--";
}
