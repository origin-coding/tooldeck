import {
  createTooldeckJsonSchemaEngine,
  prefixJsonSchemaError,
  type JsonSchemaIssue,
} from "@tooldeck/json-schema";
import type { JsonValue, PluginManifest } from "@tooldeck/protocol";

import type { PluginProjectDiagnostic } from "./project";

export type AuthoringManifestValidationResult =
  | { valid: true; manifest: PluginManifest }
  | { valid: false; diagnostics: PluginProjectDiagnostic[] };

/** Plugin-authoring adapter over the shared, Ajv-independent JSON Schema contracts. */
export function validateAuthoringManifest(
  value: unknown,
  manifestPath?: string,
): AuthoringManifestValidationResult {
  const engine = createTooldeckJsonSchemaEngine();
  const manifestCompilation = engine.compileManifest();

  if (!manifestCompilation.compiled) {
    return invalid(manifestCompilation.error.issues, manifestPath);
  }

  const validation = manifestCompilation.validator.validate(value);

  if (!validation.valid) {
    return invalid(validation.error.issues, manifestPath);
  }

  const issues: JsonSchemaIssue[] = [];

  validation.value.contributes?.commands?.forEach((command, commandIndex) => {
    if (command.inputSchema) {
      const compilation = engine.compileCommandInput(command.inputSchema, "strict");

      if (!compilation.compiled) {
        issues.push(
          ...prefixJsonSchemaError(compilation.error, {
            instancePath: `/contributes/commands/${commandIndex}/inputSchema`,
            propertyPath: `contributes.commands[${commandIndex}].inputSchema`,
          }).issues,
        );
      }
    }

    if (command.outputSchema) {
      const compilation = engine.compileCommandOutput(command.outputSchema);

      if (!compilation.compiled) {
        issues.push(
          ...prefixJsonSchemaError(compilation.error, {
            instancePath: `/contributes/commands/${commandIndex}/outputSchema`,
            propertyPath: `contributes.commands[${commandIndex}].outputSchema`,
          }).issues,
        );
      }
    }
  });

  return issues.length > 0
    ? invalid(issues, manifestPath)
    : { valid: true, manifest: validation.value };
}

export function formatAuthoringManifestDiagnostics(diagnostics: PluginProjectDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const field = diagnostic.fieldPath ? ` (${diagnostic.fieldPath})` : "";
      const suggestion = diagnostic.suggestion ? ` ${diagnostic.suggestion}` : "";

      return `${diagnostic.message}${field}.${suggestion}`;
    })
    .join("\n");
}

function invalid(
  issues: JsonSchemaIssue[],
  manifestPath: string | undefined,
): Extract<AuthoringManifestValidationResult, { valid: false }> {
  return {
    valid: false,
    diagnostics: issues.map((issue) => issueToDiagnostic(issue, manifestPath)),
  };
}

function issueToDiagnostic(
  issue: JsonSchemaIssue,
  manifestPath: string | undefined,
): PluginProjectDiagnostic {
  const fieldPath = issue.propertyPath || "<root>";
  const context = readCommandSchemaContext(fieldPath);
  const base = {
    severity: "error" as const,
    path: manifestPath,
    fieldPath,
  };

  if (context?.role === "input") {
    return { ...base, ...mapInputIssue(issue, context) };
  }

  if (context?.role === "output") {
    return { ...base, ...mapOutputIssue(issue, context) };
  }

  return {
    ...base,
    code: "MANIFEST_SCHEMA",
    message: manifestIssueMessage(issue, fieldPath),
    suggestion: manifestIssueSuggestion(issue, fieldPath),
  };
}

interface CommandSchemaContext {
  commandIndex: number;
  role: "input" | "output";
  relativePath: string;
}

function readCommandSchemaContext(fieldPath: string): CommandSchemaContext | undefined {
  const match = /^contributes\.commands\[(\d+)]\.(inputSchema|outputSchema)(.*)$/.exec(fieldPath);

  if (!match) {
    return undefined;
  }

  return {
    commandIndex: Number(match[1]),
    role: match[2] === "inputSchema" ? "input" : "output",
    relativePath: match[3] ?? "",
  };
}

function mapInputIssue(
  issue: JsonSchemaIssue,
  context: CommandSchemaContext,
): Pick<PluginProjectDiagnostic, "code" | "message" | "suggestion"> {
  const property = readStringParameter(issue, "property");

  if (issue.code === "tooldeck.input-ui.invalid-location") {
    const schemaPath = schemaDisplayPath(context.relativePath.replace(/\.x-ui(?:\..*)?$/, ""));

    return {
      code: "INPUT_SCHEMA_NESTED_X_UI",
      message: `Command at index ${context.commandIndex} ${schemaPath} must not use x-ui.`,
      suggestion: "Move x-ui to the input schema root or one of its direct properties.",
    };
  }

  if (issue.code === "tooldeck.input-ui.unsupported-property") {
    return {
      code: "INPUT_SCHEMA_X_UI",
      message: `Unsupported inputSchema.x-ui property: ${property ?? "unknown"}`,
      suggestion: "Only inputSchema.x-ui.fieldOrder is supported at the input schema root.",
    };
  }

  if (issue.code === "tooldeck.input-ui.control.unsupported-property") {
    const fieldName = directPropertyName(context.relativePath) ?? "field";

    return {
      code: "INPUT_FIELD_X_UI",
      message: `Unsupported x-ui property on ${fieldName}: ${property ?? "unknown"}`,
      suggestion: `Remove ${property ?? "the unsupported property"} or use an input control that supports it.`,
    };
  }

  if (issue.code === "tooldeck.input-ui.control.incompatible") {
    const fieldName = directPropertyName(context.relativePath) ?? "field";
    const control = typeof issue.actual === "string" ? issue.actual : "selected control";

    return {
      code: "INPUT_FIELD_X_UI_CONTROL",
      message: `x-ui.control ${control} is incompatible with the schema for ${fieldName}.`,
      suggestion: "Use a control compatible with the field type and enum shape.",
    };
  }

  if (issue.code === "tooldeck.input-ui.field-order.unknown-property") {
    const fieldName = typeof issue.actual === "string" ? issue.actual : "unknown field";

    return {
      code: "INPUT_SCHEMA_FIELD_ORDER",
      message: `inputSchema.x-ui.fieldOrder references unknown field: ${fieldName}`,
      suggestion: `Add "${fieldName}" to inputSchema.properties or remove it from fieldOrder.`,
    };
  }

  if (context.relativePath.includes(".x-i18n")) {
    return mapI18nIssue(issue, context);
  }

  if (issue.keyword === "additionalProperties" && property) {
    const nodePath = removeTrailingProperty(context.relativePath, property);

    return {
      code: "INPUT_SCHEMA_UNSUPPORTED_KEYWORD",
      message: `Command at index ${context.commandIndex} ${schemaDisplayPath(nodePath)} uses unsupported inputSchema keyword: ${property}`,
      suggestion: `Remove ${property} from the command inputSchema or replace it with a supported JSON Schema keyword.`,
    };
  }

  if (context.relativePath.endsWith(".type") && Array.isArray(issue.actual)) {
    const nodePath = context.relativePath.slice(0, -".type".length);

    return {
      code: "INPUT_SCHEMA_UNSUPPORTED_TYPE",
      message: `Command at index ${context.commandIndex} ${schemaDisplayPath(nodePath)}.type must be a single supported type.`,
      suggestion: "Use a single supported JSON Schema type instead of a type array.",
    };
  }

  const shape = inputShapeDiagnostic(issue, context);

  if (shape) {
    return shape;
  }

  return {
    code: issue.code.startsWith("schema.") ? "INPUT_SCHEMA_COMPILE" : "INPUT_SCHEMA",
    message: `Command at index ${context.commandIndex} inputSchema is invalid: ${issue.message}`,
    suggestion: schemaIssueSuggestion(issue, "inputSchema"),
  };
}

function mapOutputIssue(
  issue: JsonSchemaIssue,
  context: CommandSchemaContext,
): Pick<PluginProjectDiagnostic, "code" | "message" | "suggestion"> {
  if (issue.code === "tooldeck.output-ui.forbidden") {
    return {
      code: "OUTPUT_SCHEMA_X_UI",
      message: `Command at index ${context.commandIndex} outputSchema must not use x-ui.`,
      suggestion:
        "Remove x-ui from outputSchema. UI hints are only supported on command input schemas.",
    };
  }

  return {
    code: issue.code.startsWith("schema.") ? "OUTPUT_SCHEMA_COMPILE" : "OUTPUT_SCHEMA",
    message: `Command at index ${context.commandIndex} outputSchema is invalid: ${issue.message}`,
    suggestion: schemaIssueSuggestion(issue, "outputSchema"),
  };
}

function mapI18nIssue(
  issue: JsonSchemaIssue,
  context: CommandSchemaContext,
): Pick<PluginProjectDiagnostic, "code" | "message" | "suggestion"> {
  const relative = context.relativePath;
  const schemaRelative = relative.slice(0, relative.indexOf(".x-i18n"));
  const i18nRelative = relative.slice(relative.indexOf(".x-i18n") + 1);
  const schemaPath = schemaDisplayPath(schemaRelative);

  if (i18nRelative.startsWith("x-i18n.enumLabels.")) {
    const enumValue = i18nRelative.slice("x-i18n.enumLabels.".length);

    return {
      code: "SCHEMA_X_I18N",
      message: `Command at index ${context.commandIndex} ${schemaPath}.x-i18n.enumLabels.${enumValue} must be a locale key string.`,
      suggestion: `Change the enum label for "${enumValue}" to a locale key string.`,
    };
  }

  if (i18nRelative === "x-i18n.enumLabels") {
    return {
      code: "SCHEMA_X_I18N",
      message: `Command at index ${context.commandIndex} ${schemaPath}.x-i18n.enumLabels must be an object of locale key strings.`,
      suggestion:
        "Change x-i18n.enumLabels to an object mapping enum values to locale key strings.",
    };
  }

  const property = readStringParameter(issue, "property");

  if (issue.keyword === "additionalProperties" && property) {
    return {
      code: "SCHEMA_X_I18N",
      message: `Unsupported x-i18n property: ${property}`,
      suggestion: "Only x-i18n.title, x-i18n.description, and x-i18n.enumLabels are supported.",
    };
  }

  const key = i18nRelative.replace(/^x-i18n\.?/, "") || "x-i18n";

  return {
    code: "SCHEMA_X_I18N",
    message:
      key === "x-i18n"
        ? `Command at index ${context.commandIndex} ${schemaPath}.x-i18n must be an object.`
        : `Command at index ${context.commandIndex} ${schemaPath}.x-i18n.${key} must be a locale key string.`,
    suggestion:
      key === "x-i18n"
        ? "Change x-i18n to an object containing locale key strings, or remove it."
        : `Change x-i18n.${key} to a locale key string.`,
  };
}

function inputShapeDiagnostic(
  issue: JsonSchemaIssue,
  context: CommandSchemaContext,
): Pick<PluginProjectDiagnostic, "code" | "message" | "suggestion"> | undefined {
  const shapes = {
    properties: [
      "INPUT_SCHEMA_PROPERTIES",
      "an object",
      "an object whose values are schema objects",
    ],
    required: [
      "INPUT_SCHEMA_REQUIRED",
      "an array of field names",
      "an array of string field names",
    ],
    items: ["INPUT_SCHEMA_ITEMS", "a schema object", "a schema object"],
    allOf: [
      "INPUT_SCHEMA_ALLOF",
      "an array of schema objects",
      "an array of schema objects, or remove it",
    ],
    additionalProperties: [
      "INPUT_SCHEMA_ADDITIONAL_PROPERTIES",
      "a boolean or schema object",
      "true, false, or a schema object",
    ],
  } as const;
  const keyword = Object.keys(shapes).find((key) => context.relativePath.endsWith(`.${key}`)) as
    | keyof typeof shapes
    | undefined;

  if (!keyword || (issue.keyword !== "type" && issue.keyword !== "enum")) {
    return undefined;
  }

  const [code, expected, replacement] = shapes[keyword];
  const nodePath = context.relativePath.slice(0, -(keyword.length + 1));

  return {
    code,
    message: `Command at index ${context.commandIndex} ${schemaDisplayPath(nodePath)}.${keyword} must be ${expected}.`,
    suggestion: `Change ${keyword} to ${replacement}.`,
  };
}

function manifestIssueMessage(issue: JsonSchemaIssue, fieldPath: string): string {
  if (issue.keyword === "required") return `${fieldPath} is required.`;
  if (issue.keyword === "additionalProperties") {
    return `${fieldPath} is not supported by the Tooldeck manifest schema.`;
  }
  if (issue.keyword === "type") {
    const expected = readStringParameter(issue, "type") ?? jsonValueLabel(issue.expected);
    return `${fieldPath} must be ${expected ?? "the expected type"}.`;
  }
  if (issue.keyword === "enum") return `${fieldPath} must be one of the allowed values.`;
  if (issue.keyword === "const") return `${fieldPath} must match the required value.`;
  return `${fieldPath} ${issue.message}.`;
}

function manifestIssueSuggestion(issue: JsonSchemaIssue, fieldPath: string): string {
  if (issue.keyword === "required") return requiredFieldSuggestion(fieldPath);
  if (issue.keyword === "additionalProperties") {
    return `Remove ${fieldPath} from manifest.json, or move it under a supported Tooldeck manifest field.`;
  }
  if (issue.keyword === "type") {
    const expected = readStringParameter(issue, "type") ?? jsonValueLabel(issue.expected);
    return expected
      ? `Change ${fieldPath} to a JSON ${expected} value.`
      : `Change ${fieldPath} to the type required by the manifest schema.`;
  }
  if (issue.keyword === "enum" || issue.keyword === "const") {
    return `Use a value for ${fieldPath} that is allowed by the manifest schema.`;
  }
  return `Update ${fieldPath} so it matches the Tooldeck manifest schema.`;
}

function requiredFieldSuggestion(fieldPath: string): string {
  const suggestions: Record<string, string> = {
    schemaVersion: 'Add "schemaVersion": "1.0" to manifest.json.',
    id: 'Add a stable plugin id, for example "id": "dev.example.my-plugin".',
    name: 'Add a plugin name, for example "name": { "key": "plugin.name", "default": "My Plugin" }.',
    version: 'Add a package-style version, for example "version": "0.1.0".',
    runtime: 'Add "runtime": { "kind": "node", "entry": "./dist/index.js" }.',
    "runtime.kind": 'Add "runtime.kind": "node".',
    "runtime.entry": 'Add "runtime.entry": "./dist/index.js".',
  };

  return suggestions[fieldPath] ?? `Add ${fieldPath} to manifest.json.`;
}

function schemaIssueSuggestion(issue: JsonSchemaIssue, schemaField: string): string {
  if (issue.code === "schema.invalid-pattern") {
    return `Replace the invalid pattern in ${schemaField} with a valid regular expression.`;
  }
  if (issue.code === "schema.unresolved-reference" || issue.keyword === "$ref") {
    return `Remove $ref from ${schemaField}; Tooldeck command profiles do not resolve references.`;
  }
  if (issue.code === "schema.unsupported-format" || issue.keyword === "format") {
    return `Remove format from ${schemaField}; Tooldeck command profiles do not register formats.`;
  }
  return `Update ${issue.propertyPath || schemaField} so it matches the Tooldeck ${schemaField} profile.`;
}

function readStringParameter(issue: JsonSchemaIssue, key: string): string | undefined {
  const value = issue.parameters?.[key];
  return typeof value === "string" ? value : undefined;
}

function jsonValueLabel(value: JsonValue | JsonValue[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function removeTrailingProperty(relativePath: string, property: string): string {
  const suffix = `.${property}`;
  return relativePath.endsWith(suffix) ? relativePath.slice(0, -suffix.length) : relativePath;
}

function schemaDisplayPath(relativePath: string): string {
  return relativePath ? `$${relativePath}` : "$";
}

function directPropertyName(relativePath: string): string | undefined {
  return /^\.properties\.([^.[\]]+)\.x-ui(?:\.|$)/.exec(relativePath)?.[1];
}
