import type { JsonObject, TooldeckJsonSchema } from "@tooldeck/protocol";

import { normalizeInputWithSchema, toJsonObject } from "@/commands/input-normalizer";

export type CommandInputCoercion = "none" | "cli";

export type CommandInputIssue =
  | "unknown_property"
  | "missing_required"
  | "invalid_type"
  | "below_minimum"
  | "above_maximum"
  | "below_exclusive_minimum"
  | "above_exclusive_maximum"
  | "below_min_length"
  | "above_max_length"
  | "pattern_mismatch"
  | "invalid_enum"
  | "invalid_const"
  | "below_min_items"
  | "above_max_items"
  | "duplicate_items"
  | "not_json_serializable";

export interface CommandInputContext {
  commandId?: string;
  coercion: CommandInputCoercion;
}

export interface NormalizeCommandInputOptions {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckJsonSchema;
  commandId?: string;
  coercion?: CommandInputCoercion;
}

export function normalizeCommandInput(options: NormalizeCommandInputOptions): JsonObject {
  const input = options.input ?? {};

  if (!options.inputSchema) {
    return toJsonObject(input);
  }

  return normalizeInputWithSchema({
    input,
    inputSchema: options.inputSchema,
    commandId: options.commandId,
    coercion: options.coercion ?? "none",
  });
}
