import type { CommandResult } from "@tooldeck/protocol";

import type { CommandInputState } from "@/renderer/app/command-input";
import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPlugin,
  DesktopPluginDataResidue,
  DesktopPreference,
} from "@/shared/api";

export type AppView = "main" | "history" | "settings";

export type DesktopNavigationMode = "provider-first" | "entry-first";

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

export interface AppState {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  pluginDataResidues: DesktopPluginDataResidue[];
  preferences: DesktopPreference[];
  selectedCommandId?: string;
  selectedPluginId?: string;
  historyCommandId?: string;
  input: CommandInputState;
  result?: CommandResult;
  history: CommandRunRecord[];
  pluginInstall: PluginInstallState;
  pluginCleanupWarning?: PluginCleanupWarning;
  isLoadingData: boolean;
  isRunning: boolean;
  loadError?: string;
  runError?: string;
}

export const initialState: AppState = {
  commands: [],
  plugins: [],
  pluginDataResidues: [],
  preferences: [],
  input: {},
  history: [],
  pluginInstall: { status: "idle" },
  isLoadingData: false,
  isRunning: false,
};
