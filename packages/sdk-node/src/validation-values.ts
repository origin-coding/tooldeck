export function formatPath(propertyPath: string): string {
  return propertyPath ? `--${propertyPath}` : "--";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function describeValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return "array";
  }

  if (value instanceof Date) {
    return "Date";
  }

  return typeof value;
}
