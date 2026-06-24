import path from "node:path";

import type { PluginManifest } from "@tooldeck/protocol";

export const DEFAULT_GENERATED_COMMANDS_PATH = path.join("src", "generated", "commands.ts");

export type PluginProjectDiagnosticSeverity = "error" | "warning";

export interface PluginProjectDiagnostic {
  severity: PluginProjectDiagnosticSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface CheckPluginProjectOptions {
  manifestPath?: string;
  generatedPath?: string;
  built?: boolean;
}

export interface CheckPluginProjectResult {
  ok: boolean;
  manifest?: PluginManifest;
  manifestPath: string;
  manifestDir: string;
  diagnostics: PluginProjectDiagnostic[];
}

export type PluginBuildBundler = "vite";

export type PluginBuildStage = "generate" | "check" | "vite build" | "check --built";

export interface BuildPluginProjectOptions {
  manifestPath?: string;
  generatedPath?: string;
  bundler?: string;
}

export interface BuildPluginProjectResult {
  bundler: PluginBuildBundler;
  stages: PluginBuildStage[];
}

export interface InspectPluginProjectOptions {
  manifestPath?: string;
  generatedPath?: string;
}

export interface InspectPluginProjectResult {
  manifestPath: string;
  manifestDir: string;
  plugin?: {
    id: string;
    name: string;
    version: string;
  };
  runtimeEntry?: string;
  commands: string[];
  activationEvents: string[];
  locales: LocaleInspection[];
  generated: FileInspection;
  buildOutput: FileInspection;
  packageManager?: string;
  tooldeckPackages: TooldeckPackageInspection[];
  diagnostics: PluginProjectDiagnostic[];
}

export interface LocaleInspection {
  locale: string;
  path: string;
  exists: boolean;
  missingKeys: string[];
}

export interface FileInspection {
  path: string;
  exists: boolean;
  status: string;
}

export interface TooldeckPackageInspection {
  name: string;
  version: string;
  source: "dependencies" | "devDependencies" | "peerDependencies";
}
