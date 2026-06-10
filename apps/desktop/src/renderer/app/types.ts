import type { CommandResult } from "@tooldeck/protocol";

import type {
  CommandRunRecord,
  DesktopCommand,
  DesktopPlugin,
  DesktopPreference,
} from "@/shared/desktop-api";

export type AppView = "main" | "history" | "settings";

export type DesktopNavigationMode = "provider-first" | "entry-first";

export interface AppState {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  preferences: DesktopPreference[];
  selectedCommandId?: string;
  selectedPluginId?: string;
  historyCommandId?: string;
  input: Record<string, string>;
  result?: CommandResult;
  history: CommandRunRecord[];
  isLoadingData: boolean;
  isRunning: boolean;
  loadError?: string;
  runError?: string;
}

export const initialState: AppState = {
  commands: [],
  plugins: [],
  preferences: [],
  input: {},
  history: [],
  isLoadingData: false,
  isRunning: false,
};
