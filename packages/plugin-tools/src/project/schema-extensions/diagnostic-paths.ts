export function inputSchemaFieldPath(
  commandIndex: number,
  schemaPath: string,
  suffix?: string,
): string {
  const normalizedSchemaPath = schemaPath === "$" ? "" : schemaPath.replace(/^\$\.?/, ".");
  const basePath = `contributes.commands[${commandIndex}].inputSchema${normalizedSchemaPath}`;

  return suffix ? `${basePath}.${suffix}` : basePath;
}

export function outputSchemaFieldPath(
  commandIndex: number,
  schemaPath: string,
  suffix?: string,
): string {
  const normalizedSchemaPath = schemaPath === "$" ? "" : schemaPath.replace(/^\$\.?/, ".");
  const basePath = `contributes.commands[${commandIndex}].outputSchema${normalizedSchemaPath}`;

  return suffix ? `${basePath}.${suffix}` : basePath;
}

export function inputFieldUiPath(
  commandIndex: number,
  propertyName: string,
  suffix?: string,
): string {
  const basePath = `contributes.commands[${commandIndex}].inputSchema.properties.${propertyName}.x-ui`;

  return suffix ? `${basePath}.${suffix}` : basePath;
}
