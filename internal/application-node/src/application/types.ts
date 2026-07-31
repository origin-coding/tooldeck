import type { TooldeckApplicationAdapters } from "@/application/adapters";
import type { ResolveTooldeckPathsOptions, TooldeckPaths } from "@/paths";

export type ApplicationCommandInputCoercion = "cli" | "none";

export type ApplicationPluginSourceKind = "builtin" | "installed" | "external";

export interface ApplicationPluginSource {
  kind: ApplicationPluginSourceKind;
  path: string;
}

export interface CreateTooldeckApplicationOptions {
  adapters?: TooldeckApplicationAdapters;
  commandInputCoercion?: ApplicationCommandInputCoercion;
  paths?: TooldeckPaths;
  pathOptions?: ResolveTooldeckPathsOptions;
  pluginSources?: readonly ApplicationPluginSource[];
}
