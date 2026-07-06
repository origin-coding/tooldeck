import path from "node:path";

import { packTooldeckPlugin } from "@tooldeck/plugin-package";

import { DEFAULT_PLUGIN_MANIFEST_PATH } from "../plugin-manifest";
import { buildPluginProject, formatPluginBuildError } from "./build";
import { checkPluginProject } from "./check";
import { formatPluginCheckResult } from "./format";
import type {
  DistPluginProjectOptions,
  DistPluginProjectResult,
  PackPluginProjectOptions,
  PackPluginProjectResult,
} from "./types";

export class PluginPackError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PluginPackError";
    this.cause = cause;
  }
}

export async function packPluginProject(
  options: PackPluginProjectOptions = {},
): Promise<PackPluginProjectResult> {
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);
  const checkResult = await checkPluginProject({
    manifestPath,
    generatedPath: options.generatedPath,
    built: true,
  });

  if (!checkResult.ok || !checkResult.manifest) {
    throw new PluginPackError(formatPluginCheckResult(checkResult));
  }

  const packageResult = await packTooldeckPlugin({
    projectDir: checkResult.manifestDir,
    manifestPath,
    outputPath: options.outputPath ? path.resolve(options.outputPath) : undefined,
  });

  return {
    packagePath: packageResult.packagePath,
    pluginId: packageResult.pluginManifest.id,
    version: packageResult.pluginManifest.version,
    files: packageResult.files,
    packageDigest: packageResult.packageDigest,
    packageSizeBytes: packageResult.packageSizeBytes,
  };
}

export async function distPluginProject(
  options: DistPluginProjectOptions = {},
): Promise<DistPluginProjectResult> {
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);

  try {
    const buildResult = await buildPluginProject({
      manifestPath,
      generatedPath: options.generatedPath,
      bundler: options.bundler ?? "vite",
    });
    const packResult = await packPluginProject({
      manifestPath,
      generatedPath: options.generatedPath,
      outputPath: options.outputPath,
    });

    return {
      ...packResult,
      stages: buildResult.stages,
    };
  } catch (error) {
    if (error instanceof PluginPackError) {
      throw error;
    }

    throw new PluginPackError(formatPluginBuildError(error), error);
  }
}

export function formatPluginPackResult(result: PackPluginProjectResult): string {
  return [
    "Tooldeck plugin package created.",
    `  Plugin: ${result.pluginId} (${result.version})`,
    `  Package: ${result.packagePath}`,
    `  Files: ${result.files.length}`,
    `  Size: ${result.packageSizeBytes} bytes`,
    `  Digest: ${result.packageDigest}`,
  ].join("\n");
}

export function formatPluginPackError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
