import type { JsonObject } from "./types";

export type TooldeckErrorCode =
  | "ERR_UNKNOWN"
  | "ERR_INVALID_ARGUMENT"
  | "ERR_NOT_FOUND"
  | "ERR_ALREADY_EXISTS"
  | "ERR_NOT_IMPLEMENTED"
  | "ERR_PLUGIN_LOAD_FAILED"
  | "ERR_COMMAND_NOT_FOUND"
  | "ERR_COMMAND_FAILED";

export interface TooldeckErrorOptions {
  code: TooldeckErrorCode;
  message: string;
  cause?: unknown;
  details?: JsonObject;
}

export class TooldeckError extends Error {
  readonly code: TooldeckErrorCode;
  readonly details?: JsonObject;

  constructor(options: TooldeckErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "TooldeckError";
    this.code = options.code;
    this.details = options.details;
  }
}
