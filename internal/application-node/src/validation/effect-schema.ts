import { Effect, ParseResult, Schema } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import { ApplicationError, type ApplicationErrorCode } from "@/errors/error";
import type {
  ApplicationValidationIssue,
  ApplicationValidationIssueCode,
} from "@/validation/types";

export interface DecodeApplicationRequestOptions {
  errorCode?: ApplicationErrorCode;
  message?: string;
  pathPrefix?: ReadonlyArray<PropertyKey>;
}

export function decodeApplicationRequest<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
  operation: string,
  options: DecodeApplicationRequestOptions = {},
): ApplicationEffect<A> {
  return Schema.decodeUnknown(schema, {
    errors: "all",
    onExcessProperty: "error",
  })(input).pipe(
    Effect.mapError(
      (parseError) =>
        new ApplicationError({
          source: "application",
          code: options.errorCode ?? "ERR_INVALID_ARGUMENT",
          message: options.message ?? `Invalid ${operation} request.`,
          cause: parseError,
          details: {
            operation,
            issues: ParseResult.ArrayFormatter.formatErrorSync(parseError).map((issue) =>
              formatValidationIssue(issue, options.pathPrefix ?? []),
            ),
          },
        }),
    ),
  );
}

export function makeInvalidApplicationRequest(options: {
  operation: string;
  path: string;
  message: string;
  issueCode?: ApplicationValidationIssueCode;
}): ApplicationError {
  return new ApplicationError({
    source: "application",
    code: "ERR_INVALID_ARGUMENT",
    message: options.message,
    details: {
      operation: options.operation,
      issues: [
        {
          code: options.issueCode ?? "invalid_value",
          path: options.path,
          message: options.message,
        },
      ],
    },
  });
}

function formatValidationIssue(
  issue: ParseResult.ArrayFormatterIssue,
  pathPrefix: ReadonlyArray<PropertyKey>,
): ApplicationValidationIssue {
  return {
    code: mapValidationIssueCode(issue._tag),
    path: toJsonPointer([...pathPrefix, ...issue.path]),
    message: issue.message,
  };
}

function mapValidationIssueCode(
  tag: ParseResult.ArrayFormatterIssue["_tag"],
): ApplicationValidationIssueCode {
  switch (tag) {
    case "Missing":
      return "missing_required";
    case "Unexpected":
      return "unexpected_property";
    case "Refinement":
      return "invalid_value";
    default:
      return "invalid_type";
  }
}

function toJsonPointer(path: ReadonlyArray<PropertyKey>): string {
  if (path.length === 0) {
    return "/";
  }

  return `/${path.map((segment) => escapeJsonPointerSegment(String(segment))).join("/")}`;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
