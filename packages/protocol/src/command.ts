import type { JsonObject } from "@tooldeck/shared";

import type { LocalizedString } from "./i18n";
import type { TooldeckJsonSchema } from "./schema";

export interface CommandDefinitionV1 {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  inputSchema?: TooldeckJsonSchema;
}

export type CommandStatusV1 = "success" | "error";

export interface TextContentBlockV1 {
  type: "text";
  text: string;
}

export type ContentBlockV1 = TextContentBlockV1;

export interface CommandErrorV1 {
  message: string;
  code?: string;
  metadata?: JsonObject;
}

export interface CommandResultV1 {
  status: CommandStatusV1;
  blocks: ContentBlockV1[];
  error?: CommandErrorV1;
}

export type CommandDefinition = CommandDefinitionV1;
export type CommandStatus = CommandStatusV1;
export type ContentBlock = ContentBlockV1;
export type TextContentBlock = TextContentBlockV1;
export type CommandError = CommandErrorV1;
export type CommandResult = CommandResultV1;
