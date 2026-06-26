import path from "node:path";

import type { PluginProjectDiagnostic, TooldeckPackageInspection } from "./types";
import { type JsonRecord, isRecord, pathExists, readJsonIfExists } from "./utils";

export async function checkPackageJson(
  manifestDir: string,
  diagnostics: PluginProjectDiagnostic[],
): Promise<void> {
  const packageJsonPath = path.join(manifestDir, "package.json");
  const packageJson = await readJsonIfExists(packageJsonPath);

  if (!packageJson) {
    diagnostics.push({
      severity: "error",
      code: "PACKAGE_JSON_MISSING",
      message: "Plugin project package.json is missing or invalid JSON.",
      path: packageJsonPath,
      suggestion: "Create a valid package.json for the plugin project.",
    });

    return;
  }

  const scripts = isRecord(packageJson.scripts) ? packageJson.scripts : {};

  for (const scriptName of ["generate", "check", "build"]) {
    if (typeof scripts[scriptName] !== "string") {
      diagnostics.push({
        severity: "error",
        code: "PACKAGE_SCRIPT_MISSING",
        message: `package.json scripts.${scriptName} is required.`,
        path: packageJsonPath,
        fieldPath: `scripts.${scriptName}`,
        suggestion: `Add a "${scriptName}" script to package.json.`,
      });
    }
  }

  const dependencies = getPackageDependencyMap(packageJson);

  for (const packageName of ["@tooldeck/sdk-node", "@tooldeck/plugin-tools"]) {
    if (!dependencies.has(packageName)) {
      diagnostics.push({
        severity: "error",
        code: "PACKAGE_DEPENDENCY_MISSING",
        message: `package.json must depend on ${packageName}.`,
        path: packageJsonPath,
        fieldPath: "dependencies",
        suggestion: `Add "${packageName}" to dependencies or devDependencies.`,
      });
    }
  }

  if ((await isViteProject(manifestDir, scripts)) && !dependencies.has("@tooldeck/vite-plugin")) {
    diagnostics.push({
      severity: "error",
      code: "PACKAGE_DEPENDENCY_MISSING",
      message: "Vite plugin projects must depend on @tooldeck/vite-plugin.",
      path: packageJsonPath,
      fieldPath: "devDependencies.@tooldeck/vite-plugin",
      suggestion: 'Add "@tooldeck/vite-plugin" to devDependencies.',
    });
  }
}

export function collectTooldeckPackages(
  packageJson: JsonRecord | undefined,
): TooldeckPackageInspection[] {
  if (!packageJson) {
    return [];
  }

  return ["dependencies", "devDependencies", "peerDependencies"].flatMap((source) => {
    const dependencies = packageJson[source];

    if (!isRecord(dependencies)) {
      return [];
    }

    return Object.entries(dependencies)
      .filter(([name]) => name.startsWith("@tooldeck/"))
      .map(([name, version]) => ({
        name,
        version: String(version),
        source: source as TooldeckPackageInspection["source"],
      }));
  });
}

function getPackageDependencyMap(packageJson: JsonRecord): Map<string, string> {
  const dependencies = new Map<string, string>();

  for (const source of ["dependencies", "devDependencies", "peerDependencies"]) {
    const values = packageJson[source];

    if (!isRecord(values)) {
      continue;
    }

    for (const [name, version] of Object.entries(values)) {
      dependencies.set(name, String(version));
    }
  }

  return dependencies;
}

async function isViteProject(manifestDir: string, scripts: JsonRecord): Promise<boolean> {
  if (Object.values(scripts).some((script) => typeof script === "string" && usesVite(script))) {
    return true;
  }

  for (const configFile of [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cts",
    "vite.config.cjs",
  ]) {
    if (await pathExists(path.join(manifestDir, configFile))) {
      return true;
    }
  }

  return false;
}

function usesVite(script: string): boolean {
  return /\bvite\s+build\b/.test(script) || /(^|\s)--bundler(?:=|\s+)vite(\s|$)/.test(script);
}
