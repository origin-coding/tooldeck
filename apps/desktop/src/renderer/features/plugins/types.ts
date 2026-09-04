export type PluginInstallState =
  | { status: "idle" }
  | { status: "installing"; packageName: string }
  | { status: "success"; pluginId: string; packageName: string }
  | { status: "error"; message: string }
  | {
      status: "refresh-failed";
      pluginId: string;
      packageName: string;
      message: string;
    };

export interface PluginCleanupWarning {
  count: number;
  step: string;
  message: string;
}
