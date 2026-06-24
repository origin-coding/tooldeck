import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import { checkLocales } from "./locale-checks";
import { checkSupportedSchemaExtensions } from "./schema-extension-checks";
import type { PluginProjectDiagnostic } from "./types";

export async function checkManifestSemantics(
  manifest: PluginManifest,
  manifestPath: string,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  if (manifest.runtime.kind !== "node") {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_UNSUPPORTED",
      message: `Unsupported runtime kind: ${manifest.runtime.kind}`,
      path: manifestPath,
    });
  }

  if (path.isAbsolute(manifest.runtime.entry)) {
    diagnostics.push({
      severity: "error",
      code: "RUNTIME_ENTRY_ABSOLUTE",
      message: "manifest.runtime.entry must be relative to the manifest file.",
      path: manifestPath,
    });
  }

  if (!manifest.runtime.entry.startsWith("./") && !manifest.runtime.entry.startsWith("../")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_RELATIVE_STYLE",
      message: "Prefer an explicit relative runtime entry such as ./dist/index.js.",
      path: manifestPath,
    });
  }

  if (!normalizePath(manifest.runtime.entry).startsWith("dist/")) {
    diagnostics.push({
      severity: "warning",
      code: "RUNTIME_ENTRY_DIST",
      message: "The recommended runtime entry points to a built file under ./dist.",
      path: manifestPath,
    });
  }

  checkUniqueCommandIds(manifest, manifestPath, diagnostics);
  checkSupportedSchemaExtensions(manifest, manifestPath, diagnostics);
  await checkLocales(manifest, manifestDir, diagnostics);
}

function checkUniqueCommandIds(
  manifest: PluginManifest,
  manifestPath: string,
  diagnostics: PluginProjectDiagnostic[],
): void {
  const seen = new Set<string>();

  for (const command of manifest.contributes?.commands ?? []) {
    if (seen.has(command.id)) {
      diagnostics.push({
        severity: "error",
        code: "COMMAND_ID_DUPLICATE",
        message: `Command id is duplicated in this manifest: ${command.id}`,
        path: manifestPath,
      });
    }

    seen.add(command.id);
  }
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
