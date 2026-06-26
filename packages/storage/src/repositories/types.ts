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
  enabled: boolean;
  installedAt: number;
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
