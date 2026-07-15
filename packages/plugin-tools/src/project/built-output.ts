import path from "node:path";
import { pathToFileURL } from "node:url";

import type { PluginManifest } from "@tooldeck/protocol";

import type { PluginProjectDiagnostic } from "./types";
import { formatUnknownError, isRecord, pathExists } from "./utils";

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
      fieldPath: "runtime.entry",
      suggestion:
        "Run tooldeck-plugin build --bundler vite, or update manifest.runtime.entry to the built file path.",
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
      fieldPath: "runtime.entry",
      suggestion:
        "Ensure the built runtime entry is valid Node ESM and can be imported without activating commands.",
    });

    return;
  }

  if (!isRecord(moduleExports) || !isRecord(moduleExports.default)) {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built runtime entry must default export a Tooldeck plugin object.",
      path: entryPath,
      fieldPath: "default",
      suggestion: "Export the plugin as the default export from the runtime entry.",
    });

    return;
  }

  if (typeof moduleExports.default.activate !== "function") {
    diagnostics.push({
      severity: "error",
      code: "BUILT_PLUGIN_DEFAULT_EXPORT",
      message: "Built default export must expose an activate(ctx) function.",
      path: entryPath,
      fieldPath: "default.activate",
      suggestion: "Export a Tooldeck plugin object with an activate(ctx) function.",
    });
  }
}
