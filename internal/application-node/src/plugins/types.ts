import type { LocalizedString, PluginManifest } from "@tooldeck/protocol";

import type { ApplicationPluginSourceKind } from "@/application/types";
import type { ApplicationCommand } from "@/commands/types";
import type { ApplicationPluginRuntimeState } from "@/commands/types";
import type { ApplicationCleanupFailureDiagnostic } from "@/errors/cleanup";

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
  cleanupFailures: ApplicationCleanupFailureDiagnostic[];
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

export interface ApplicationPluginLocaleRequest {
  locale?: string;
}

export interface ApplicationPluginFacade {
  list(request?: ApplicationPluginLocaleRequest): Promise<ApplicationPlugin[]>;
  rescan(request?: ApplicationPluginLocaleRequest): Promise<ApplicationPluginCatalog>;
  setEnabled(
    pluginId: string,
    enabled: boolean,
    request?: ApplicationPluginLocaleRequest,
  ): Promise<ApplicationPlugin>;
  installPackage(
    packagePath: string,
    request?: ApplicationPluginLocaleRequest,
  ): Promise<ApplicationPluginInstallResult>;
  uninstall(
    pluginId: string,
    request?: ApplicationPluginLocaleRequest,
  ): Promise<ApplicationPluginUninstallResult>;
  listDataResidues(): Promise<ApplicationPluginDataResidue[]>;
  purgeData(pluginId: string): Promise<ApplicationPluginPurgeResult>;
}
