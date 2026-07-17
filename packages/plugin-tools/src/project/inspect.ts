import path from "node:path";

import { checkPluginProject } from "./check";
import { inspectLocales, renderLocalizedString } from "./locale";
import { collectTooldeckPackages } from "./package-json";
import {
  DEFAULT_GENERATED_COMMANDS_PATH,
  type InspectPluginProjectOptions,
  type InspectPluginProjectResult,
} from "./types";
import { detectPackageManager, pathExists, readJsonIfExists } from "./utils";

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
  const commandIds = (manifest?.contributes?.commands ?? []).map((command) => command.id).sort();
  const locales = (await inspectLocales(manifest, baseCheck.manifestDir)).sort((a, b) =>
    a.locale.localeCompare(b.locale),
  );
  const tooldeckPackages = collectTooldeckPackages(packageJson).sort(
    (a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source),
  );

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
    commands: commandIds,
    activationEvents: commandIds.map((commandId) => `onCommand:${commandId}`),
    locales,
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
    tooldeckPackages,
    diagnostics: baseCheck.diagnostics,
  };
}
