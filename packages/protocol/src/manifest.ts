import type { CommandDefinitionV1 } from "./command";
import type { LocaleCode, LocaleResourceMap, LocalizedString } from "./i18n";

export interface PluginManifestV1 {
  $schema?: string;
  schemaVersion: "1.0";
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  version: string;
  runtime: PluginRuntimeV1;
  defaultLocale?: LocaleCode;
  locales?: LocaleResourceMap;
  contributes?: PluginContributesV1;
}

export type PluginRuntimeV1 = NodePluginRuntimeV1;

export interface NodePluginRuntimeV1 {
  kind: "node";
  entry: string;
}

export interface PluginContributesV1 {
  commands?: CommandDefinitionV1[];
}

export type PluginManifest = PluginManifestV1;
export type PluginRuntime = PluginRuntimeV1;
export type NodePluginRuntime = NodePluginRuntimeV1;
export type PluginContributes = PluginContributesV1;
