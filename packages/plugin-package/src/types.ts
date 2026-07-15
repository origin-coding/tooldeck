import type { JsonValue, LocalizedString, PluginContributes } from "@tooldeck/protocol";

export interface TooldeckPackageLimits {
  maxPackageSizeBytes: number;
  maxUncompressedSizeBytes: number;
  maxRegularFileCount: number;
}

export interface TooldeckPackageManifest {
  formatVersion: "1.0";
  manifestPath: "manifest.json";
  createdAt: string;
  files: string[];
}

export interface TooldeckPackageRuntime {
  kind: string;
  entry: string;
}

export interface TooldeckPackagePluginManifest {
  $schema?: string;
  schemaVersion: "1.0";
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  version: string;
  runtime: TooldeckPackageRuntime;
  defaultLocale?: string;
  locales?: Record<string, string>;
  contributes?: PluginContributes;
}

export interface TooldeckPackageSummary {
  packagePath: string;
  packageDigest: string;
  packageSizeBytes: number;
  packageManifest: TooldeckPackageManifest;
  pluginManifest: TooldeckPackagePluginManifest;
  files: string[];
  uncompressedSizeBytes: number;
}

export interface PackTooldeckPluginOptions {
  projectDir?: string;
  manifestPath?: string;
  outputPath?: string;
  createdAt?: Date;
  limits?: Partial<TooldeckPackageLimits>;
}

export interface ReadTooldeckPackageOptions {
  packagePath: string;
  limits?: Partial<TooldeckPackageLimits>;
}

export interface UnpackTooldeckPackageOptions extends ReadTooldeckPackageOptions {
  destinationDir: string;
}

export interface TooldeckPackageFile {
  path: string;
  data: Uint8Array;
}

export interface PackTooldeckPluginResult {
  packagePath: string;
  packageManifest: TooldeckPackageManifest;
  pluginManifest: TooldeckPackagePluginManifest;
  files: string[];
  packageDigest: string;
  packageSizeBytes: number;
}

export interface PackageJsonTooldeckConfig {
  package?: {
    include?: string[];
    exclude?: string[];
  };
}

export type UnknownJsonObject = Record<string, JsonValue | undefined>;
