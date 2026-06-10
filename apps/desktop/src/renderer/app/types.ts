import type { CommandResult } from "@tooldeck/protocol";

import type { CommandRunRecord, DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export type AppView = "plugins" | "commands" | "settings";

export interface AppState {
  commands: DesktopCommand[];
  plugins: DesktopPlugin[];
  selectedCommandId?: string;
  selectedPluginId?: string;
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
  input: {},
  history: [],
  isLoadingData: false,
  isRunning: false,
};
