import path from "node:path";

import { DEFAULT_PLUGIN_MANIFEST_PATH } from "../plugin-manifest";
import { checkBuiltOutput } from "./built-output";
import { checkGeneratedCommands } from "./generated";
import { checkManifestSemantics, readAndValidateManifest } from "./manifest";
import { checkPackageJson } from "./package-json";
import type { CheckPluginProjectOptions, CheckPluginProjectResult } from "./types";
import { hasErrorDiagnostics } from "./utils";

export async function checkPluginProject(
  options: CheckPluginProjectOptions = {},
): Promise<CheckPluginProjectResult> {
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);
  const manifestDir = path.dirname(manifestPath);
  const diagnostics: CheckPluginProjectResult["diagnostics"] = [];
  const manifest = await readAndValidateManifest(manifestPath, diagnostics);

  if (manifest) {
    await checkManifestSemantics(manifest, manifestPath, manifestDir, diagnostics);
    await checkGeneratedCommands(
      manifest,
      manifestDir,
      path.basename(manifestPath),
      options.generatedPath,
      diagnostics,
    );
    await checkPackageJson(manifestDir, diagnostics);

    if (options.built) {
      await checkBuiltOutput(manifest, manifestDir, diagnostics);
    }
  }

  return {
    ok: !hasErrorDiagnostics(diagnostics),
    manifest,
    manifestPath,
    manifestDir,
    diagnostics,
  };
}
