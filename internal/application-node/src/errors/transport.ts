import type { JsonObject } from "@tooldeck/protocol";

import {
  toApplicationError,
  type ApplicationErrorCode,
  type ApplicationErrorSource,
} from "@/errors/error";

export interface ApplicationErrorTransport {
  tag: "ApplicationError";
  source: ApplicationErrorSource;
  code: ApplicationErrorCode;
  message: string;
  details?: JsonObject;
}

export function toApplicationErrorTransport(error: unknown): ApplicationErrorTransport {
  const applicationError = toApplicationError(error);

  return {
    tag: "ApplicationError",
    source: applicationError.source,
    code: applicationError.code,
    message: applicationError.message,
    ...(applicationError.details ? { details: applicationError.details } : {}),
  };
}
