import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

import { generatePluginCommandTypes } from "./generate-command-types-core";

export async function runGenerateCommandTypesCli(args: string[]): Promise<void> {
  const [manifestArg, outputArg] = args;

  if (!manifestArg || !outputArg) {
    throw new Error("Usage: tooldeck-plugin-types <manifest.json> <output.ts>");
  }

  const manifestPath = path.resolve(manifestArg);
  const outputPath = path.resolve(outputArg);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as PluginManifest;
  const output = generatePluginCommandTypes(manifest);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output, "utf8");
}
