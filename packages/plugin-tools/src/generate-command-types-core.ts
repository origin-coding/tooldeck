import type { PluginManifest, TooldeckJsonSchema } from "@tooldeck/protocol";

export function generatePluginCommandTypes(manifest: PluginManifest): string {
  const commands = manifest.contributes?.commands ?? [];
  const declarations: string[] = [];
  const mapEntries: string[] = [];

  for (const command of commands) {
    const typeName = commandInputTypeName(command.id);

    declarations.push(`export interface ${typeName} ${schemaToType(command.inputSchema)}`);
    mapEntries.push(`  ${JSON.stringify(command.id)}: ${typeName};`);
  }

  return [
    "// This file is generated from manifest.json. Do not edit it by hand.",
    "",
    ...declarations.flatMap((declaration) => [declaration, ""]),
    "export interface PluginCommandInputs {",
    ...mapEntries,
    "}",
    "",
  ].join("\n");
}

function commandInputTypeName(commandId: string): string {
  const words = commandId
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return `${words.join("") || "Command"}Input`;
}

function schemaToType(schema: TooldeckJsonSchema | undefined): string {
  if (!schema) {
    return "Record<string, unknown>;";
  }

  if (getSchemaType(schema) !== "object") {
    return `${schemaValueToType(schema)};`;
  }

  const properties = normalizeProperties(schema.properties);
  const required = new Set(schema.required ?? []);
  const lines = Object.entries(properties).map(([propertyName, propertySchema]) => {
    const optional = required.has(propertyName) ? "" : "?";

    return `  ${quotePropertyName(propertyName)}${optional}: ${schemaValueToType(propertySchema)};`;
  });

  if (schema.additionalProperties !== false) {
    lines.push("  [key: string]: unknown;");
  }

  return ["{", ...lines, "}"].join("\n");
}

function schemaValueToType(schema: TooldeckJsonSchema): string {
  if (schema.enum?.length) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  const type = getSchemaType(schema);

  if (type === "integer" || type === "number") {
    return "number";
  }

  if (type === "boolean") {
    return "boolean";
  }

  if (type === "array") {
    const itemSchema = normalizeSchema(schema.items);
    const itemType = itemSchema ? schemaValueToType(itemSchema) : "unknown";

    return `${wrapArrayItemType(itemType)}[]`;
  }

  if (type === "object") {
    return schemaToType(schema).replace(/;$/, "");
  }

  if (type === "null") {
    return "null";
  }

  return "string";
}

function normalizeProperties(
  properties: TooldeckJsonSchema["properties"],
): Record<string, TooldeckJsonSchema> {
  const normalized: Record<string, TooldeckJsonSchema> = {};

  if (!properties) {
    return normalized;
  }

  for (const [propertyName, propertySchema] of Object.entries(properties)) {
    const normalizedSchema = normalizeSchema(propertySchema);

    if (normalizedSchema) {
      normalized[propertyName] = normalizedSchema;
    }
  }

  return normalized;
}

function normalizeSchema(schema: unknown): TooldeckJsonSchema | undefined {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return undefined;
  }

  return schema as TooldeckJsonSchema;
}

function getSchemaType(schema: TooldeckJsonSchema): string {
  if (!schema.type) {
    return "string";
  }

  return Array.isArray(schema.type) ? schema.type[0] : schema.type;
}

function quotePropertyName(propertyName: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(propertyName)) {
    return propertyName;
  }

  return JSON.stringify(propertyName);
}

function wrapArrayItemType(type: string): string {
  return type.includes(" | ") ? `(${type})` : type;
}
