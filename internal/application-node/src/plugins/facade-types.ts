import type { LocalizedString, PluginManifest } from "@tooldeck/protocol";

import type { ApplicationPluginSourceKind } from "@/application/types";
import type { ApplicationCommand } from "@/commands/types";
import type { ApplicationPluginRuntimeState } from "@/commands/types";

export interface ApplicationPlugin {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  manifest: PluginManifest;
  version: string;
  manifestPath: string;
  sourceKind: ApplicationPluginSourceKind;
  enabled: boolean;
  runtimeState: ApplicationPluginRuntimeState;
  commandCount: number;
  updatedAt: number;
}

export interface ApplicationPluginInstall {
  pluginId: string;
  version: string;
  installDir: string;
  manifestPath: string;
  packageName: string;
  packageDigest: string;
  packageSizeBytes: number;
  installedAt: number;
  updatedAt: number;
}

export interface ApplicationInstalledPlugin {
  id: string;
  name: LocalizedString;
  version: string;
  manifestPath: string;
  sourceKind: ApplicationPluginSourceKind;
  enabled: boolean;
  updatedAt: number;
}

export interface ApplicationPluginCatalog {
  commands: ApplicationCommand[];
  plugins: ApplicationPlugin[];
}

export interface ApplicationPluginDataResidue {
  kvEntries: number;
  pluginId: string;
  statePresent: boolean;
}

export interface ApplicationPluginInstallResult {
  status: "installed" | "installed-refresh-failed";
  installedPluginId: string;
  packageName: string;
  install: ApplicationPluginInstall;
  plugin: ApplicationInstalledPlugin;
  refreshError?: string;
  catalog?: ApplicationPluginCatalog;
}

export interface ApplicationPluginUninstallResult {
  cleanupError?: string;
  cleanupPending: boolean;
  filesMissing: boolean;
  pluginId: string;
  install: ApplicationPluginInstall;
  catalog: ApplicationPluginCatalog;
  residues: ApplicationPluginDataResidue[];
}

export interface ApplicationPluginPurgeResult {
  kvEntriesRemoved: number;
  pluginId: string;
  stateRemoved: boolean;
  residues: ApplicationPluginDataResidue[];
}

export interface ApplicationPluginFacade {
  list(): Promise<ApplicationPlugin[]>;
  rescan(): Promise<ApplicationPluginCatalog>;
  setEnabled(pluginId: string, enabled: boolean): Promise<ApplicationPlugin>;
  installPackage(packagePath: string): Promise<ApplicationPluginInstallResult>;
  uninstall(pluginId: string): Promise<ApplicationPluginUninstallResult>;
  listDataResidues(): Promise<ApplicationPluginDataResidue[]>;
  purgeData(pluginId: string): Promise<ApplicationPluginPurgeResult>;
}
