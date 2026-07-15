import type { PreferenceScope } from "@tooldeck/preferences";
import type { StateCreator } from "zustand";

import type { CommandInputValue } from "@/renderer/app/command-input";
import type { AppState, AppView } from "@/renderer/app/types";
import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export interface DesktopStore extends AppState {
  view: AppView;
  setView(view: AppView): void;
  loadData(): Promise<void>;
  loadHistory(commandId?: string): Promise<void>;
  openCommandHistory(commandId?: string): Promise<void>;
  rescanPlugins(): Promise<void>;
  installDroppedPluginPackage(file: File): Promise<void>;
  selectCommand(command: DesktopCommand): void;
  selectPlugin(plugin: DesktopPlugin): void;
  updateInput(key: string, value: CommandInputValue): void;
  runSelectedCommand(): Promise<void>;
  setPreference(scope: PreferenceScope, key: string, value: unknown): Promise<void>;
  setPluginEnabled(pluginId: string, enabled: boolean): Promise<void>;
}

export type DesktopStoreSlice<T> = StateCreator<DesktopStore, [], [], T>;
