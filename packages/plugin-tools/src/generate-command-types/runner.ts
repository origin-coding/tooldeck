import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { readPluginManifest } from "../plugin-manifest";
import { generatePluginCommandTypes } from "./index";

const DEFAULT_OUTPUT_PATH = path.join("src", "generated", "commands.ts");

export interface GenerateCommandTypesOptions {
  manifestPath?: string;
  outputPath?: string;
}

export interface RunGenerateCommandTypesCliOptions {
  commandName?: string;
}

export async function generateCommandTypesFile(
  options: GenerateCommandTypesOptions = {},
): Promise<void> {
  const manifestResult = await readPluginManifest({ manifestPath: options.manifestPath });
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const output = await generatePluginCommandTypes(manifestResult.manifest, {
    cwd: manifestResult.manifestDir,
    sourceLabel: manifestResult.sourceLabel,
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  if ((await readFileIfExists(outputPath)) === output) {
    return;
  }

  await writeFile(outputPath, output, "utf8");
}

export const generatePluginCommandTypesFile = generateCommandTypesFile;

export async function runGenerateCommandTypesCli(
  args: string[],
  options: RunGenerateCommandTypesCliOptions = {},
): Promise<void> {
  const parsed = parseGenerateCommandTypesArgs(args, options);

  await generateCommandTypesFile(parsed);
}

function parseGenerateCommandTypesArgs(
  args: string[],
  options: RunGenerateCommandTypesCliOptions,
): GenerateCommandTypesOptions {
  const commandName = options.commandName ?? "tooldeck-plugin generate types";
  const parsed: GenerateCommandTypesOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--manifest" || arg === "--out") {
      const value = args[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error(`Missing value for ${arg}\nUsage: ${usage(commandName)}`);
      }

      if (arg === "--manifest") {
        parsed.manifestPath = value;
      } else {
        parsed.outputPath = value;
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      parsed.manifestPath = parseEqualsValue(arg, "--manifest", commandName);
      continue;
    }

    if (arg.startsWith("--out=")) {
      parsed.outputPath = parseEqualsValue(arg, "--out", commandName);
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}\nUsage: ${usage(commandName)}`);
  }

  return parsed;
}

function parseEqualsValue(arg: string, name: "--manifest" | "--out", commandName: string): string {
  const value = arg.slice(name.length + 1);

  if (!value) {
    throw new Error(`Missing value for ${name}\nUsage: ${usage(commandName)}`);
  }

  return value;
}

function usage(commandName: string): string {
  return `${commandName} [--manifest manifest.json] [--out src/generated/commands.ts]`;
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}
