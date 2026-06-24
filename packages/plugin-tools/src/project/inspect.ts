import path from "node:path";

import { readJsonIfExists } from "./json";
import { checkPluginProject } from "./check";
import { detectPackageManager, pathExists } from "./fs";
import { inspectLocales } from "./locale-checks";
import { renderLocalizedString } from "./localization";
import { collectTooldeckPackages } from "./package-json-checks";
import {
  DEFAULT_GENERATED_COMMANDS_PATH,
  type InspectPluginProjectOptions,
  type InspectPluginProjectResult,
} from "./types";

export async function inspectPluginProject(
  options: InspectPluginProjectOptions = {},
): Promise<InspectPluginProjectResult> {
  const baseCheck = await checkPluginProject({
    manifestPath: options.manifestPath,
    generatedPath: options.generatedPath,
    built: false,
  });
  const manifest = baseCheck.manifest;
  const generatedPath = path.resolve(
    baseCheck.manifestDir,
    options.generatedPath ?? DEFAULT_GENERATED_COMMANDS_PATH,
  );
  const buildOutputPath = manifest
    ? path.resolve(baseCheck.manifestDir, manifest.runtime.entry)
    : path.resolve(baseCheck.manifestDir, "dist", "index.js");
  const packageJson = await readJsonIfExists(path.join(baseCheck.manifestDir, "package.json"));
  const buildOutputExists = await pathExists(buildOutputPath);

  return {
    manifestPath: baseCheck.manifestPath,
    manifestDir: baseCheck.manifestDir,
    plugin: manifest
      ? {
          id: manifest.id,
          name: renderLocalizedString(manifest.name),
          version: manifest.version,
        }
      : undefined,
    runtimeEntry: manifest?.runtime.entry,
    commands: manifest?.contributes?.commands?.map((command) => command.id) ?? [],
    activationEvents:
      manifest?.contributes?.commands?.map((command) => `onCommand:${command.id}`) ?? [],
    locales: await inspectLocales(manifest, baseCheck.manifestDir),
    generated: {
      path: generatedPath,
      exists: await pathExists(generatedPath),
      status: baseCheck.diagnostics.some((diagnostic) => diagnostic.code === "GENERATED_STALE")
        ? "stale"
        : "in sync",
    },
    buildOutput: {
      path: buildOutputPath,
      exists: buildOutputExists,
      status: buildOutputExists ? "present" : "missing",
    },
    packageManager: await detectPackageManager(baseCheck.manifestDir),
    tooldeckPackages: collectTooldeckPackages(packageJson),
    diagnostics: baseCheck.diagnostics,
  };
}
