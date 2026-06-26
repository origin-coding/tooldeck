import type { TooldeckInputJsonSchema } from "@tooldeck/protocol";

export interface GeneratePluginCommandTypesOptions {
  cwd?: string;
  sourceLabel?: string;
}

export interface GeneratedCommandTypesModel {
  sourceLabel: string;
  commands: GeneratedCommand[];
}

export interface GeneratedCommand {
  id: string;
  inputTypeName: string;
  commandIdKey: string;
  inputSchema: TooldeckInputJsonSchema;
}
