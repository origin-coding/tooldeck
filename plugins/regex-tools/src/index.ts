import type { CommandHandler } from "@tooldeck/sdk-node";
import {
  codeBlock,
  definePlugin,
  failText,
  jsonBlock,
  ok,
  propertiesBlock,
} from "@tooldeck/sdk-node";

import type {
  PluginCommandInputs,
  RegexEscapeInput,
  RegexExtractInput,
  RegexReplaceInput,
  RegexTestInput,
} from "./generated/commands";

type RegexFlag = NonNullable<RegexTestInput["flags"]>[number];
type ExtractSection = NonNullable<RegexExtractInput["sections"]>[number];
type JsonMatch = {
  match?: string;
  index?: number;
  end?: number;
  groups?: Array<string | null>;
  namedGroups?: Record<string, string | null>;
  context?: string;
};

const flagOrder: RegexFlag[] = ["g", "i", "m", "s", "u", "y"];
const defaultExtractSections: ExtractSection[] = ["match", "index", "groups", "stats"];

export default definePlugin<PluginCommandInputs>((plugin) => {
  plugin.command("regex.test", testRegex);
  plugin.command("regex.extract", extractRegex);
  plugin.command("regex.replace", replaceRegex);
  plugin.command("regex.escape", escapeRegex);
});

const testRegex: CommandHandler<RegexTestInput> = async (input) => {
  const pattern = input.mode === "full" ? `^(?:${input.pattern})$` : input.pattern;
  const regex = createRegex(pattern, input.flags);

  if (regex instanceof Error) {
    return invalidRegex(regex);
  }

  const match = regex.exec(input.text);
  const matched = match !== null;

  return ok([
    propertiesBlock([
      { label: outputLabel("matched", "Matched"), value: matched },
      { label: outputLabel("mode", "Mode"), value: input.mode ?? "contains" },
      {
        label: outputLabel("flags", "Flags"),
        value: normalizeFlags(input.flags).join("") || "(none)",
      },
      { label: outputLabel("index", "Index"), value: match?.index ?? null },
      { label: outputLabel("match", "Match"), value: match?.[0] ?? null },
    ]),
    jsonBlock({
      matched,
      mode: input.mode ?? "contains",
      pattern: input.pattern,
      flags: normalizeFlags(input.flags),
      match: match
        ? {
            text: match[0],
            index: match.index,
            end: match.index + match[0].length,
            groups: normalizeCaptureGroups(match.slice(1)),
            namedGroups: normalizeNamedGroups(match.groups),
          }
        : null,
    }),
  ]);
};

const extractRegex: CommandHandler<RegexExtractInput> = async (input) => {
  const maxMatches = normalizeMaxMatches(input.maxMatches);
  const flags = normalizeFlags(input.flags);
  const regex = createRegex(input.pattern, ensureFlag(flags, "g"));

  if (regex instanceof Error) {
    return invalidRegex(regex);
  }

  const sections = input.sections?.length ? input.sections : defaultExtractSections;
  const includeGroups = input.includeGroups ?? true;
  const matches: JsonMatch[] = [];
  let truncated = false;

  for (const match of input.text.matchAll(regex)) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }

    matches.push(createJsonMatch(match, input.text, sections, includeGroups));
  }

  const summaryBlock = propertiesBlock([
    { label: outputLabel("matches", "Matches"), value: matches.length },
    { label: outputLabel("maxMatches", "Max Matches"), value: maxMatches },
    { label: outputLabel("flags", "Flags"), value: ensureFlag(flags, "g").join("") },
    { label: outputLabel("truncated", "Truncated"), value: truncated },
  ]);
  const outputBlock = sections.includes("json")
    ? jsonBlock({ matches })
    : codeBlock(JSON.stringify(matches, null, 2), "json");

  return ok([summaryBlock, outputBlock]);
};

const replaceRegex: CommandHandler<RegexReplaceInput> = async (input) => {
  const flags =
    input.scope === "first"
      ? removeFlag(normalizeFlags(input.flags), "g")
      : ensureFlag(normalizeFlags(input.flags), "g");
  const regex = createRegex(input.pattern, flags);

  if (regex instanceof Error) {
    return invalidRegex(regex);
  }

  const matchCount = countReplacements(input.text, regex, input.scope ?? "all");
  const result = input.text.replace(regex, input.replacement);

  return ok([
    propertiesBlock([
      { label: outputLabel("replacements", "Replacements"), value: matchCount },
      { label: outputLabel("scope", "Scope"), value: input.scope ?? "all" },
      { label: outputLabel("flags", "Flags"), value: flags.join("") || "(none)" },
    ]),
    codeBlock(result, "text"),
  ]);
};

const escapeRegex: CommandHandler<RegexEscapeInput> = async (input) => {
  const escaped = escapeRegExp(input.text);
  const wrapped = input.wrapWithSlashes ? `/${escaped}/` : escaped;
  const target = input.target ?? "pattern";
  const output =
    target === "javascript-string"
      ? JSON.stringify(wrapped)
      : target === "javascript-regexp"
        ? input.wrapWithSlashes
          ? `/${escaped}/`
          : `new RegExp(${JSON.stringify(escaped)})`
        : wrapped;

  return ok([
    propertiesBlock([
      { label: outputLabel("target", "Target"), value: target },
      { label: outputLabel("wrapped", "Wrapped"), value: input.wrapWithSlashes ?? false },
    ]),
    codeBlock(output, target === "pattern" ? "text" : "javascript"),
  ]);
};

function createRegex(pattern: string, flags: RegexFlag[] | undefined): RegExp | Error {
  try {
    return new RegExp(pattern, normalizeFlags(flags).join(""));
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

function normalizeFlags(flags: RegexFlag[] | undefined): RegexFlag[] {
  const set = new Set(flags ?? []);

  return flagOrder.filter((flag) => set.has(flag));
}

function ensureFlag(flags: RegexFlag[], flag: RegexFlag): RegexFlag[] {
  return flags.includes(flag) ? flags : normalizeFlags([...flags, flag]);
}

function removeFlag(flags: RegexFlag[], flag: RegexFlag): RegexFlag[] {
  return flags.filter((value) => value !== flag);
}

function normalizeMaxMatches(value: number | undefined): number {
  if (!Number.isInteger(value) || value === undefined) {
    return 50;
  }

  return Math.min(Math.max(value, 1), 500);
}

function createJsonMatch(
  match: RegExpMatchArray,
  text: string,
  sections: ExtractSection[],
  includeGroups: boolean,
): JsonMatch {
  const index = match.index ?? 0;
  const value = match[0];
  const result: JsonMatch = {};

  if (sections.includes("match")) {
    result.match = value;
  }

  if (sections.includes("index")) {
    result.index = index;
    result.end = index + value.length;
  }

  if (includeGroups && sections.includes("groups")) {
    result.groups = normalizeCaptureGroups(match.slice(1));
  }

  if (includeGroups && sections.includes("namedGroups")) {
    result.namedGroups = normalizeNamedGroups(match.groups);
  }

  if (sections.includes("context")) {
    result.context = text.slice(Math.max(0, index - 20), index + value.length + 20);
  }

  return result;
}

function countReplacements(text: string, regex: RegExp, scope: "first" | "all"): number {
  if (scope === "first") {
    regex.lastIndex = 0;
    const matched = regex.exec(text) !== null;
    regex.lastIndex = 0;

    return matched ? 1 : 0;
  }

  const countRegex = createRegex(
    regex.source,
    ensureFlag(normalizeFlags(regex.flags.split("") as RegexFlag[]), "g"),
  );

  if (countRegex instanceof Error) {
    return 0;
  }

  return [...text.matchAll(countRegex)].length;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCaptureGroups(groups: string[]): Array<string | null> {
  return groups.map((group) => group ?? null);
}

function normalizeNamedGroups(
  groups: Record<string, string> | undefined,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(groups ?? {}).map(([key, value]) => [key, value ?? null]),
  );
}

function invalidRegex(error: Error) {
  return failText(
    "ERR_INVALID_REGEX",
    error.message,
    `Invalid regular expression: ${error.message}`,
  );
}

function outputLabel(key: string, fallback: string) {
  return {
    key: `output.properties.${key}`,
    default: fallback,
  };
}
