import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PluginManifest } from "@tooldeck/protocol";

import { formatUnknownError } from "./diagnostics";
import { pathExists } from "./fs";
import { isRecord } from "./json";
import type { PluginProjectDiagnostic } from "./types";

export async function checkBuiltOutput(
  manifest: PluginManifest,
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const entryPath = path.resolve(manifestDir, manifest.runtime.entry);

  if (!(await pathExists(entryPath))) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_ENTRY_MISSING",
      message: "manifest.runtime.entry does not point to an existing built file.",
      path: entryPath,
    });

    return;
  }

  let moduleExports: unknown;

  try {
    // This checks ESM loadability and top-level module shape, but does not activate the plugin.
    moduleExports = await import(`${pathToFileURL(entryPath).href}?tooldeck-check=${Date.now()}`);
  } catch (error) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_ENTRY_IMPORT_FAILED",
      message: `Built runtime entry is not ESM-loadable: ${formatUnknownError(error)}`,
      path: entryPath,
    });

    return;
  }

  if (!isRecord(moduleExports) || !isRecord(moduleExports.default)) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built runtime entry must default export a Tooldeck plugin object.",
      path: entryPath,
    });

    return;
  }

  if (typeof moduleExports.default.activate !== "function") {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built default export must expose an activate(ctx) function.",
      path: entryPath,
    });
  }
}
