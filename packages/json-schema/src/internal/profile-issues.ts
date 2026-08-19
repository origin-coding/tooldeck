import type { JsonSchemaIssue } from "../contracts";
import { deduplicateIssues } from "./issues";
import { parseJsonPointer } from "./json";

type ManifestSchemaContext =
  | { role: "input"; relativeSegments: string[] }
  | { role: "output"; relativeSegments: string[] };

/** @internal */
export function classifyManifestProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return deduplicateIssues(
    issues.map((issue) => {
      const context = readManifestSchemaContext(issue.instancePath);

      if (context?.role === "input") {
        return classifyInputIssue(issue, context.relativeSegments);
      }

      if (context?.role === "output") {
        return classifyOutputIssue(issue);
      }

      return issue;
    }),
  );
}

/** @internal */
export function classifyInputProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return deduplicateIssues(
    issues.map((issue) => classifyInputIssue(issue, parseJsonPointer(issue.instancePath) ?? [])),
  );
}

/** @internal */
export function classifyOutputProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return deduplicateIssues(issues.map(classifyOutputIssue));
}

function classifyInputIssue(issue: JsonSchemaIssue, relativeSegments: string[]): JsonSchemaIssue {
  if (issue.keyword !== "additionalProperties") {
    return issue;
  }

  const property = readAdditionalProperty(issue);

  if (property === "x-ui" && !isInputUiLocation(relativeSegments)) {
    return {
      ...issue,
      code: "tooldeck.input-ui.invalid-location",
      message: "Input UI hints are only allowed at the input root or on direct properties",
    };
  }

  if (matchesSegments(relativeSegments, ["x-ui"])) {
    return {
      ...issue,
      code: "tooldeck.input-ui.unsupported-property",
      message: "Input root UI hint is not supported",
    };
  }

  if (
    relativeSegments.length === 3 &&
    relativeSegments[0] === "properties" &&
    relativeSegments[2] === "x-ui"
  ) {
    return {
      ...issue,
      code: "tooldeck.input-ui.control.unsupported-property",
      message: "Input control UI hint is not supported",
    };
  }

  return issue;
}

function classifyOutputIssue(issue: JsonSchemaIssue): JsonSchemaIssue {
  if (issue.keyword !== "additionalProperties" || readAdditionalProperty(issue) !== "x-ui") {
    return issue;
  }

  return {
    ...issue,
    code: "tooldeck.output-ui.forbidden",
    message: "Command output Schema must not use input UI hints",
  };
}

function isInputUiLocation(relativeSegments: string[]): boolean {
  return (
    relativeSegments.length === 0 ||
    (relativeSegments.length === 2 && relativeSegments[0] === "properties")
  );
}

function readAdditionalProperty(issue: JsonSchemaIssue): string | undefined {
  const property = issue.parameters?.property;

  return typeof property === "string" ? property : undefined;
}

function readManifestSchemaContext(instancePath: string): ManifestSchemaContext | undefined {
  const segments = parseJsonPointer(instancePath);

  if (
    !segments ||
    segments[0] !== "contributes" ||
    segments[1] !== "commands" ||
    !isArrayIndex(segments[2])
  ) {
    return undefined;
  }

  if (segments[3] === "inputSchema") {
    return { role: "input", relativeSegments: segments.slice(4) };
  }

  if (segments[3] === "outputSchema") {
    return { role: "output", relativeSegments: segments.slice(4) };
  }

  return undefined;
}

function isArrayIndex(value: string | undefined): boolean {
  return value !== undefined && /^(0|[1-9]\d*)$/.test(value);
}

function matchesSegments(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length && actual.every((part, index) => part === expected[index])
  );
}
