import type { JsonSchemaIssue } from "../contracts";

/** @internal */
export function classifyManifestProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return issues.map((issue) => {
    if (issue.instancePath.includes("/inputSchema")) {
      return classifyInputIssue(issue, pathAfter(issue.instancePath, "/inputSchema"));
    }

    if (issue.instancePath.includes("/outputSchema")) {
      return classifyOutputIssue(issue);
    }

    return issue;
  });
}

/** @internal */
export function classifyInputProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return issues.map((issue) => classifyInputIssue(issue, issue.instancePath));
}

/** @internal */
export function classifyOutputProfileIssues(issues: JsonSchemaIssue[]): JsonSchemaIssue[] {
  return issues.map(classifyOutputIssue);
}

function classifyInputIssue(issue: JsonSchemaIssue, relativeInstancePath: string): JsonSchemaIssue {
  if (issue.keyword !== "additionalProperties") {
    return issue;
  }

  const property = readAdditionalProperty(issue);

  if (property === "x-ui" && !isInputUiLocation(relativeInstancePath)) {
    return {
      ...issue,
      code: "tooldeck.input-ui.invalid-location",
      message: "Input UI hints are only allowed at the input root or on direct properties",
    };
  }

  if (relativeInstancePath === "/x-ui") {
    return {
      ...issue,
      code: "tooldeck.input-ui.unsupported-property",
      message: "Input root UI hint is not supported",
    };
  }

  if (/^\/properties\/[^/]+\/x-ui$/.test(relativeInstancePath)) {
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

function isInputUiLocation(relativeInstancePath: string): boolean {
  return relativeInstancePath === "" || /^\/properties\/[^/]+$/.test(relativeInstancePath);
}

function readAdditionalProperty(issue: JsonSchemaIssue): string | undefined {
  const property = issue.parameters?.property;

  return typeof property === "string" ? property : undefined;
}

function pathAfter(path: string, marker: string): string {
  const index = path.lastIndexOf(marker);

  return index < 0 ? path : path.slice(index + marker.length);
}
