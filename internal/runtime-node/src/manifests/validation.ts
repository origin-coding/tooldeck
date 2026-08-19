import type { PluginManifest } from "@tooldeck/protocol";

import { RuntimeError } from "@/errors/error";
import { RuntimeJsonSchema } from "@/json-schema/runtime-json-schema";

export interface ParsePluginManifestTextOptions {
  text: string;
  manifestPath?: string;
}

export interface ValidatePluginManifestOptions {
  manifest: unknown;
  manifestPath?: string;
}

export function parsePluginManifestText(options: ParsePluginManifestTextOptions): PluginManifest {
  let manifest: unknown;

  try {
    manifest = JSON.parse(options.text);
  } catch (error) {
    throw new RuntimeError({
      code: "ERR_INVALID_ARGUMENT",
      message: formatManifestErrorMessage(
        "Plugin manifest is not valid JSON",
        options.manifestPath,
      ),
      cause: error,
      details: {
        manifestPath: options.manifestPath ?? null,
      },
    });
  }

  return validatePluginManifest({
    manifest,
    manifestPath: options.manifestPath,
  });
}

export function validatePluginManifest(options: ValidatePluginManifestOptions): PluginManifest {
  return new RuntimeJsonSchema().validateManifest(options.manifest, options.manifestPath);
}

function formatManifestErrorMessage(message: string, manifestPath: string | undefined): string {
  if (!manifestPath) {
    return message;
  }

  return `${message}: ${manifestPath}`;
}
