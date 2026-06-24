import type { ErrorObject } from "ajv";

import type { PluginProjectDiagnostic } from "./types";

export function hasErrorDiagnostics(diagnostics: PluginProjectDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function normalizeAjvErrors(errors: ErrorObject[]): {
  path: string;
  message: string;
}[] {
  return errors.map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "failed validation",
  }));
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
