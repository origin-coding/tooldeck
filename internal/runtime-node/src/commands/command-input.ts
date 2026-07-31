import type { JsonObject, TooldeckJsonSchema } from "@tooldeck/protocol";

import { parseRawCliInputOptions } from "@/commands/command-input-cli";
import { normalizeInputWithSchema, toJsonObject } from "@/commands/command-input-normalizer";
import type { CommandInputCoercion } from "@/commands/command-input-types";

export interface NormalizeCommandInputOptions {
  input?: Record<string, unknown>;
  inputSchema?: TooldeckJsonSchema;
  commandId?: string;
  coercion?: CommandInputCoercion;
}

export interface ParseCommandInputFromCliArgsOptions {
  rawArgs: string[];
  commandId: string;
  inputSchema?: TooldeckJsonSchema;
  ignoredOptions?: string[];
}

export interface ParseRawCommandInputFromCliArgsOptions {
  rawArgs: string[];
  commandId: string;
  ignoredOptions?: string[];
}

export type { CommandInputCoercion };

export function parseCommandInputFromCliArgs(
  options: ParseCommandInputFromCliArgsOptions,
): JsonObject {
  return normalizeCommandInput({
    input: parseRawCliInputOptions({
      rawArgs: options.rawArgs,
      commandId: options.commandId,
      ignoredOptions: options.ignoredOptions ?? [],
    }),
    inputSchema: options.inputSchema,
    commandId: options.commandId,
    coercion: "cli",
  });
}

export function parseRawCommandInputFromCliArgs(
  options: ParseRawCommandInputFromCliArgsOptions,
): JsonObject {
  return toJsonObject(
    parseRawCliInputOptions({
      rawArgs: options.rawArgs,
      commandId: options.commandId,
      ignoredOptions: options.ignoredOptions ?? [],
    }),
  );
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
