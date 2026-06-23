// This file is generated from manifest.json. Do not edit it by hand.

export type JSONText = string;
export type IndentSize = number;

export interface JsonFormatInput {
  text: JSONText;
  indent?: IndentSize;
}

export interface PluginCommandInputs {
  "json.format": JsonFormatInput;
}

export type PluginCommandId = keyof PluginCommandInputs;

export type PluginCommandInput<TCommandId extends PluginCommandId> =
  PluginCommandInputs[TCommandId];

export const commandIds = {
  jsonFormat: "json.format",
} as const;
