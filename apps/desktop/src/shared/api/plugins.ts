import type { CatalogLocaleRequest, DesktopCommand } from "./commands";

export type DesktopPluginSourceKind = "builtin" | "installed" | "external";

export interface DesktopPlugin {
  id: string;
  name: string;
  description?: string;
  version: string;
  manifestPath: string;
  sourceKind: DesktopPluginSourceKind;
  enabled: boolean;
  runtimeState: "inactive" | "activating" | "active" | "deactivating" | "failed" | "disposed";
  commandCount: number;
  updatedAt: number;
  searchText: string[];
}

export interface DesktopPluginDataResidue {
  kvEntries: number;
  pluginId: string;
  statePresent: boolean;
}

export type ListPluginsRequest = CatalogLocaleRequest;

export type RescanPluginsRequest = CatalogLocaleRequest;

export interface SetPluginEnabledRequest {
  pluginId: string;
  enabled: boolean;
  locale?: string;
}

export interface InstallPluginPackageIpcRequest extends CatalogLocaleRequest {
  packagePath: string;
}

export interface UninstallPluginRequest extends CatalogLocaleRequest {
  pluginId: string;
}

export interface PurgePluginDataRequest {
  pluginId: string;
}

export interface InstalledDesktopPluginResult {
  status: "installed";
  installedPluginId: string;
  packageName: string;
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
}

export interface InstalledDesktopPluginRefreshFailedResult {
  status: "installed-refresh-failed";
  installedPluginId: string;
  packageName: string;
  refreshError: string;
}

export type DesktopPluginInstallResult =
  | InstalledDesktopPluginResult
  | InstalledDesktopPluginRefreshFailedResult;

export interface DesktopPluginUninstallResult {
  cleanupError?: string;
  cleanupPending: boolean;
  commands: DesktopCommand[];
  filesMissing: boolean;
  pluginId: string;
  plugins: DesktopPlugin[];
  residues: DesktopPluginDataResidue[];
}

export interface DesktopPluginPurgeResult {
  kvEntriesRemoved: number;
  pluginId: string;
  residues: DesktopPluginDataResidue[];
  stateRemoved: boolean;
}

export interface DesktopPluginsApi {
  list(request?: ListPluginsRequest): Promise<DesktopPlugin[]>;
  listDataResidues(): Promise<DesktopPluginDataResidue[]>;
  setEnabled(request: SetPluginEnabledRequest): Promise<DesktopPlugin>;
  installDroppedPackage(
    file: File,
    request?: CatalogLocaleRequest,
  ): Promise<DesktopPluginInstallResult>;
  uninstall(request: UninstallPluginRequest): Promise<DesktopPluginUninstallResult>;
  purgeData(request: PurgePluginDataRequest): Promise<DesktopPluginPurgeResult>;
  rescan(request?: RescanPluginsRequest): Promise<{
    commands: DesktopCommand[];
    plugins: DesktopPlugin[];
  }>;
}
