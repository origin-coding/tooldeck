import path from "node:path";

import {
  ApplicationError,
  type ApplicationValidationIssue,
  type ApplicationValidationIssueCode,
  listPreferenceDefinitions,
  type PreferenceDefinition,
} from "@tooldeck/application-node";
import type { JsonObject, JsonValue } from "@tooldeck/protocol";
import { Either, ParseResult, Schema } from "effect";

import type {
  GetPreferenceRequest,
  InstallPluginPackageIpcRequest,
  ListCommandRunsRequest,
  ListCommandsRequest,
  ListPluginsRequest,
  PurgePluginDataRequest,
  RescanPluginsRequest,
  RunCommandRequest,
  SetPluginEnabledRequest,
  SetPreferenceRequest,
  UninstallPluginRequest,
} from "@/shared/api";

const NonEmptyStringSchema = Schema.String.pipe(
  Schema.minLength(1, { message: () => "Expected a non-empty string" }),
);

const LocaleRequestSchema = Schema.Struct({
  locale: Schema.optional(Schema.String),
});

const JsonObjectSchema = Schema.Unknown.pipe(
  Schema.filter((value): value is JsonObject => isJsonObject(value), {
    message: () => "Expected a JSON object",
  }),
);

const RunCommandRequestSchema = Schema.Struct({
  commandId: NonEmptyStringSchema,
  input: Schema.optional(JsonObjectSchema),
  locale: Schema.optional(Schema.String),
});

const SetPluginEnabledRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
  enabled: Schema.Boolean,
  locale: Schema.optional(Schema.String),
});

const InstallPluginPackageRequestSchema = Schema.Struct({
  packagePath: Schema.String.pipe(
    Schema.filter(path.isAbsolute, { message: () => "Expected an absolute path" }),
  ),
  locale: Schema.optional(Schema.String),
});

const UninstallPluginRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
  locale: Schema.optional(Schema.String),
});

const PurgePluginDataRequestSchema = Schema.Struct({
  pluginId: NonEmptyStringSchema,
});

const DesktopPreferenceRequestSchema = Schema.Struct({
  scope: Schema.Literal("shared", "desktop"),
  key: Schema.String,
}).pipe(
  Schema.filter((request) =>
    isKnownDesktopPreference(request)
      ? true
      : {
          path: ["key"],
          message: `Unsupported Desktop preference: ${request.scope}.${request.key}`,
        },
  ),
);

const SetPreferenceRequestSchema = Schema.Struct({
  scope: Schema.Literal("shared", "desktop"),
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(Schema.filter((request) => validateDesktopPreference(request)));

const ListCommandRunsRequestSchema = Schema.Struct({
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  commandId: Schema.optional(NonEmptyStringSchema),
});

type DesktopPreferenceDefinition = PreferenceDefinition & { scope: "shared" | "desktop" };

const desktopPreferenceDefinitions = listPreferenceDefinitions().filter(
  (definition): definition is DesktopPreferenceDefinition =>
    definition.scope === "shared" || definition.scope === "desktop",
);

export function decodeListCommandsRequest(value: unknown): ListCommandsRequest {
  return decodeRequest(LocaleRequestSchema, defaultRequest(value), "commands.list");
}

export function decodeRunCommandRequest(value: unknown): RunCommandRequest {
  return decodeRequest(RunCommandRequestSchema, value, "commands.run");
}

export function decodeListPluginsRequest(value: unknown): ListPluginsRequest {
  return decodeRequest(LocaleRequestSchema, defaultRequest(value), "plugins.list");
}

export function decodeRescanPluginsRequest(value: unknown): RescanPluginsRequest {
  return decodeRequest(LocaleRequestSchema, defaultRequest(value), "plugins.rescan");
}

export function decodeSetPluginEnabledRequest(value: unknown): SetPluginEnabledRequest {
  return decodeRequest(SetPluginEnabledRequestSchema, value, "plugins.setEnabled");
}

export function decodeInstallPluginPackageRequest(value: unknown): InstallPluginPackageIpcRequest {
  return decodeRequest(InstallPluginPackageRequestSchema, value, "plugins.installPackage");
}

export function decodeUninstallPluginRequest(value: unknown): UninstallPluginRequest {
  return decodeRequest(UninstallPluginRequestSchema, value, "plugins.uninstall");
}

export function decodePurgePluginDataRequest(value: unknown): PurgePluginDataRequest {
  return decodeRequest(PurgePluginDataRequestSchema, value, "plugins.purgeData");
}

export function decodeGetPreferenceRequest(value: unknown): GetPreferenceRequest {
  return decodeRequest(DesktopPreferenceRequestSchema, value, "preferences.get");
}

export function decodeSetPreferenceRequest(value: unknown): SetPreferenceRequest {
  return decodeRequest(SetPreferenceRequestSchema, value, "preferences.set");
}

export function decodeListCommandRunsRequest(value: unknown): ListCommandRunsRequest {
  return decodeRequest(ListCommandRunsRequestSchema, defaultRequest(value), "history.listRuns");
}

function decodeRequest<A, I>(
  schema: Schema.Schema<A, I, never>,
  value: unknown,
  operation: string,
): A {
  const decoded = Schema.decodeUnknownEither(schema, {
    errors: "all",
    onExcessProperty: "error",
  })(value);

  if (Either.isRight(decoded)) {
    return decoded.right;
  }

  throw new ApplicationError({
    source: "application",
    code: "ERR_INVALID_ARGUMENT",
    message: `Invalid ${operation} request.`,
    cause: decoded.left,
    details: {
      operation,
      issues: ParseResult.ArrayFormatter.formatErrorSync(decoded.left).map(formatValidationIssue),
    },
  });
}

function formatValidationIssue(issue: ParseResult.ArrayFormatterIssue): ApplicationValidationIssue {
  return {
    code: mapValidationIssueCode(issue._tag),
    path: toJsonPointer(issue.path),
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

function defaultRequest(value: unknown): unknown {
  return value === undefined ? {} : value;
}

function isKnownDesktopPreference(request: { scope: "shared" | "desktop"; key: string }): boolean {
  return findDesktopPreferenceDefinition(request) !== undefined;
}

function validateDesktopPreference(request: {
  scope: "shared" | "desktop";
  key: string;
  value: unknown;
}): boolean | { path: ["key"] | ["value"]; message: string } {
  const definition = findDesktopPreferenceDefinition(request);

  if (!definition) {
    return {
      path: ["key"],
      message: `Unsupported Desktop preference: ${request.scope}.${request.key}`,
    };
  }

  if (definition.valueType === "boolean") {
    return typeof request.value === "boolean"
      ? true
      : { path: ["value"], message: `Preference ${definition.key} must be a boolean value` };
  }

  return typeof request.value === "string" && definition.values?.includes(request.value)
    ? true
    : {
        path: ["value"],
        message: `Preference ${definition.key} must be one of: ${definition.values?.join(", ") ?? ""}`,
      };
}

function findDesktopPreferenceDefinition(request: {
  scope: "shared" | "desktop";
  key: string;
}): DesktopPreferenceDefinition | undefined {
  return desktopPreferenceDefinitions.find(
    (definition) => definition.scope === request.scope && definition.key === request.key,
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);

  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every(isJsonValue)
  );
}
