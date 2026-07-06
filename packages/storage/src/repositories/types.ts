export interface CommandRunRow {
  id: string;
  commandId: string;
  pluginId: string | null;
  source: string;
  status: string;
  inputJson: string | null;
  outputJson: string | null;
  errorJson: string | null;
  durationMs: number | null;
  createdAt: number;
}

export interface PluginRow {
  id: string;
  nameJson: string;
  version: string;
  manifestPath: string;
  sourceKind: string;
  installDir: string | null;
  enabled: boolean;
  installedAt: number;
  updatedAt: number;
}

export interface PluginInstallRow {
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

export interface PluginStateRow {
  pluginId: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PluginKvRow {
  pluginId: string;
  key: string;
  valueJson: string;
  updatedAt: number;
}

export interface PreferenceRow {
  scope: string;
  key: string;
  valueJson: string;
  updatedAt: number;
}
