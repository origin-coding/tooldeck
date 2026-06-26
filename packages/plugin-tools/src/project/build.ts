import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { generatePluginCommandTypesFile } from "../generate-command-types-runner";
import { DEFAULT_PLUGIN_MANIFEST_PATH } from "../plugin-manifest";
import { checkPluginProject } from "./check";
import { formatPluginCheckResult } from "./format";
import type {
  BuildPluginProjectOptions,
  BuildPluginProjectResult,
  PluginBuildBundler,
  PluginBuildStage,
} from "./types";

interface ViteModule {
  build: (options?: { root?: string; clearScreen?: boolean }) => Promise<unknown>;
}

export class PluginBuildError extends Error {
  readonly stage: PluginBuildStage | "setup";

  constructor(stage: PluginBuildStage | "setup", message: string, cause?: unknown) {
    super(message);
    this.name = "PluginBuildError";
    this.stage = stage;
    this.cause = cause;
  }
}

export async function buildPluginProject(
  options: BuildPluginProjectOptions = {},
): Promise<BuildPluginProjectResult> {
  const bundler = normalizeBundler(options.bundler);
  const manifestPath = path.resolve(options.manifestPath ?? DEFAULT_PLUGIN_MANIFEST_PATH);
  const manifestDir = path.dirname(manifestPath);
  const stages: PluginBuildStage[] = [];

  await runStage("generate", stages, async () => {
    await generatePluginCommandTypesFile({
      manifestPath,
      outputPath: options.generatedPath,
    });
  });

  await runStage("check", stages, async () => {
    const result = await checkPluginProject({
      manifestPath,
      generatedPath: options.generatedPath,
    });

    if (!result.ok) {
      throw new Error(formatPluginCheckResult(result));
    }
  });

  await runStage("vite build", stages, async () => {
    const vite = await importVite(manifestDir);

    await vite.build({
      root: manifestDir,
      clearScreen: false,
    });
  });

  await runStage("check --built", stages, async () => {
    const result = await checkPluginProject({
      manifestPath,
      generatedPath: options.generatedPath,
      built: true,
    });

    if (!result.ok) {
      throw new Error(formatPluginCheckResult(result));
    }
  });

  return {
    bundler,
    stages,
  };
}

export function formatPluginBuildError(error: unknown): string {
  if (error instanceof PluginBuildError) {
    return `tooldeck-plugin build failed during ${error.stage}.\n${error.message}`;
  }

  return error instanceof Error ? error.message : String(error);
}

async function runStage(
  stage: PluginBuildStage,
  stages: PluginBuildStage[],
  action: () => Promise<void>,
): Promise<void> {
  stages.push(stage);

  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new PluginBuildError(stage, message, error);
  }
}

function normalizeBundler(bundler: string | undefined): PluginBuildBundler {
  if (!bundler) {
    throw new PluginBuildError(
      "setup",
      'Missing required --bundler value. Supported bundler: "vite".',
    );
  }

  if (bundler !== "vite") {
    throw new PluginBuildError(
      "setup",
      `Unsupported bundler "${bundler}". Supported bundler: "vite".`,
    );
  }

  return bundler;
}

async function importVite(projectDir: string): Promise<ViteModule> {
  let viteEntry: string;

  try {
    const requireFromProject = createRequire(path.join(projectDir, "package.json"));

    viteEntry = requireFromProject.resolve("vite");
  } catch (error) {
    throw new Error(
      [
        "Vite could not be resolved from the plugin project.",
        "Install vite in the plugin project and run tooldeck-plugin build --bundler vite again.",
        error instanceof Error ? error.message : String(error),
      ].join("\n"),
    );
  }

  const vite = (await import(pathToFileURL(viteEntry).href)) as Partial<ViteModule>;

  if (typeof vite.build !== "function") {
    throw new Error(`Resolved Vite module does not export build(): ${viteEntry}`);
  }

  return vite as ViteModule;
}
