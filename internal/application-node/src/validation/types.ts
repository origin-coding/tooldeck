import type { JsonObject } from "@tooldeck/protocol";

export type ApplicationValidationIssueCode =
  | "invalid_type"
  | "missing_required"
  | "unexpected_property"
  | "invalid_value";

export interface ApplicationValidationIssue extends JsonObject {
  code: ApplicationValidationIssueCode;
  path: string;
  message: string;
}
