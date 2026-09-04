// UI operation ports are supplied by the route; features do not import app coordination.
export interface PluginActions {
  install(file: File): Promise<string | undefined>;
  rescan(): Promise<void>;
  setEnabled(pluginId: string, enabled: boolean): Promise<boolean>;
  uninstall(pluginId: string): Promise<boolean>;
  purge(pluginId: string): Promise<boolean>;
}
