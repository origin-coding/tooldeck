import type { TooldeckPackageLimits } from "./types";

export const TOOLDECK_PACKAGE_EXTENSION = ".tdplugin";

export const TOOLDECK_PACKAGE_MANIFEST_PATH = "tooldeck-package.json";

export const TOOLDECK_PLUGIN_MANIFEST_PATH = "manifest.json";

export const TOOLDECK_PACKAGE_FORMAT_VERSION = "1.0";

export const DEFAULT_PACKAGE_LIMITS = {
  maxPackageSizeBytes: 50 * 1024 * 1024,
  maxUncompressedSizeBytes: 50 * 1024 * 1024,
  maxRegularFileCount: 1000,
} as const satisfies TooldeckPackageLimits;

export const DEFAULT_PACKAGE_INCLUDE_DIRS = ["dist", "assets"] as const;
