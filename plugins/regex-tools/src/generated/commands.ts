// This file is generated from manifest.json. Do not edit it by hand.

export interface RegexTestInput {
  pattern: string;
  text: string;
  flags?: ("g" | "i" | "m" | "s" | "u" | "y")[];
  mode?: "contains" | "full";
}

export interface RegexExtractInput {
  pattern: string;
  text: string;
  flags?: ("g" | "i" | "m" | "s" | "u" | "y")[];
  maxMatches?: number;
  includeGroups?: boolean;
  sections?: ("match" | "index" | "groups" | "namedGroups" | "context" | "stats" | "json")[];
}

export interface RegexReplaceInput {
  pattern: string;
  replacement: string;
  text: string;
  flags?: ("g" | "i" | "m" | "s" | "u" | "y")[];
  scope?: "first" | "all";
}

export interface RegexEscapeInput {
  text: string;
  target?: "pattern" | "javascript-string" | "javascript-regexp";
  wrapWithSlashes?: boolean;
}

export interface PluginCommandInputs {
  "regex.test": RegexTestInput;
  "regex.extract": RegexExtractInput;
  "regex.replace": RegexReplaceInput;
  "regex.escape": RegexEscapeInput;
}

export type PluginCommandId = keyof PluginCommandInputs;

export type PluginCommandInput<TCommandId extends PluginCommandId> =
  PluginCommandInputs[TCommandId];

export const commandIds = {
  regexTest: "regex.test",
  regexExtract: "regex.extract",
  regexReplace: "regex.replace",
  regexEscape: "regex.escape",
} as const;
