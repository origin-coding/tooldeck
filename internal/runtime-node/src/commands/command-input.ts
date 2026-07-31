import type { JsonObject, TooldeckJsonSchema } from "@tooldeck/protocol";

import { normalizeInputWithSchema, toJsonObject } from "@/commands/command-input-normalizer";
import type { CommandInputCoercion } from "@/commands/command-input-types";

export interface NormalizeCommandInputOptions {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckJsonSchema;
  commandId?: string;
  coercion?: CommandInputCoercion;
}

export type { CommandInputCoercion };

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
