import type { JsonObject } from "@tooldeck/protocol";

export interface CommandInputPreprocessContext {
  commandId: string;
  source: string;
  input: JsonObject;
}

export type CommandInputPreprocessor = (
  context: CommandInputPreprocessContext,
) => JsonObject | Promise<JsonObject>;

export interface CommandApplicationAdapter {
  preprocessInput?: CommandInputPreprocessor;
}

export interface TooldeckApplicationAdapters {
  commands?: CommandApplicationAdapter;
}

export const identityCommandInputPreprocessor: CommandInputPreprocessor = ({ input }) => input;
