import { readFile } from "node:fs/promises";

export type JsonRecord = Record<string, unknown>;

export async function readJsonIfExists(jsonPath: string): Promise<JsonRecord | undefined> {
  try {
    const text = await readFile(jsonPath, "utf8");
    const parsed: unknown = JSON.parse(text);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
