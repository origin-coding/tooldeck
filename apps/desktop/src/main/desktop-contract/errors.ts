import {
  type ApplicationCleanupFailureDiagnostic,
  toApplicationErrorTransport,
} from "@tooldeck/application-node";

import type { DesktopApiError, DesktopCleanupFailureDiagnostic } from "@/shared/api";

export function toDesktopApiError(error: unknown): DesktopApiError {
  const transport = toApplicationErrorTransport(error);

  return {
    tag: "ApplicationError",
    source: transport.source,
    code: transport.code,
    message: transport.message,
    ...(transport.details === undefined ? {} : { details: transport.details }),
  };
}

export function toDesktopCleanupFailure(
  diagnostic: ApplicationCleanupFailureDiagnostic,
): DesktopCleanupFailureDiagnostic {
  return {
    phase: diagnostic.phase,
    step: diagnostic.step,
    context: {
      ...("pluginId" in diagnostic.context && diagnostic.context.pluginId !== undefined
        ? { pluginId: diagnostic.context.pluginId }
        : {}),
      ...("stagingEntry" in diagnostic.context && diagnostic.context.stagingEntry !== undefined
        ? { stagingEntry: diagnostic.context.stagingEntry }
        : {}),
      ...("runtimeKind" in diagnostic.context && diagnostic.context.runtimeKind !== undefined
        ? { runtimeKind: diagnostic.context.runtimeKind }
        : {}),
    },
    error: {
      source: diagnostic.error.source,
      code: diagnostic.error.code,
      message: diagnostic.error.message,
      ...(diagnostic.error.details === undefined ? {} : { details: diagnostic.error.details }),
    },
  };
}
