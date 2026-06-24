import path from "node:path";

import { type JsonRecord, isRecord, readJsonIfExists } from "./json";
import type { PluginProjectDiagnostic, TooldeckPackageInspection } from "./types";

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
      });
    }
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
