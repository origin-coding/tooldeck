// This file is generated from manifest.json. Do not edit it by hand.

export type Pattern = string;
export type Text = string;
export type Flags = ("g" | "i" | "m" | "s" | "u" | "y")[];
export type MatchMode = "contains" | "full";

export interface RegexTestInput {
  pattern: Pattern;
  text: Text;
  flags?: Flags;
  mode?: MatchMode;
}

export type Pattern = string;
export type Text = string;
export type Flags = ("g" | "i" | "m" | "s" | "u" | "y")[];
export type MaxMatches = number;
export type IncludeGroups = boolean;
export type OutputSections = ("match" | "index" | "groups" | "namedGroups" | "context" | "stats" | "json")[];

export interface RegexExtractInput {
  pattern: Pattern;
  text: Text;
  flags?: Flags;
  maxMatches?: MaxMatches;
  includeGroups?: IncludeGroups;
  sections?: OutputSections;
}

export type Pattern = string;
export type Replacement = string;
export type Text = string;
export type Flags = ("g" | "i" | "m" | "s" | "u" | "y")[];
export type ReplacementScope = "first" | "all";

export interface RegexReplaceInput {
  pattern: Pattern;
  replacement: Replacement;
  text: Text;
  flags?: Flags;
  scope?: ReplacementScope;
}

export type Text = string;
export type OutputTarget = "pattern" | "javascript-string" | "javascript-regexp";
export type WrapWithSlashes = boolean;

export interface RegexEscapeInput {
  text: Text;
  target?: OutputTarget;
  wrapWithSlashes?: WrapWithSlashes;
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
