import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import { generatePluginCommandTypes } from "../generate-command-types/index";
import { formatUnknownError } from "./diagnostics";
import { DEFAULT_GENERATED_COMMANDS_PATH, type PluginProjectDiagnostic } from "./types";

export async function checkGeneratedCommands(
  manifest: PluginManifest,
  manifestDir: string,
  sourceLabel: string,
  generatedPath: string | undefined,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const resolvedPath = path.resolve(manifestDir, generatedPath ?? DEFAULT_GENERATED_COMMANDS_PATH);
  let expected: string;

  try {
    expected = await generatePluginCommandTypes(manifest, {
      cwd: manifestDir,
      sourceLabel,
    });
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_TYPES_FAILED",
      message: `Could not generate command types from manifest: ${formatUnknownError(error)}`,
      path: resolvedPath,
    });

    return;
  }

  let current: string;

  try {
    current = await readFile(resolvedPath, "utf8");
  } catch {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_MISSING",
      message: "Generated command types file is missing. Run tooldeck-plugin generate.",
      path: resolvedPath,
    });

    return;
  }

  if (normalizeNewlines(current) !== normalizeNewlines(expected)) {
    diagnostics.push({
      severity: "error",
      code: "GENERATED_STALE",
      message: "Generated command types are out of sync. Run tooldeck-plugin generate.",
      path: resolvedPath,
    });
  }
}

function normalizeNewlines(value: string): string {
  return value.replaceAll("\r\n", "\n");
}
