import type {
  CommandInputState,
  CommandInputValue,
} from "@/renderer/features/commands/command-input";

import { commandPath, pluginPath } from "./routes";

interface DesktopSession {
  path?: string;
  drafts: Record<string, CommandInputState>;
}
const key = "tooldeck.desktop.nuxt";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function isInputValue(value: unknown): value is CommandInputValue {
  const primitive = (item: unknown) =>
    item === null ||
    typeof item === "string" ||
    typeof item === "boolean" ||
    (typeof item === "number" && Number.isFinite(item));
  return primitive(value) || (Array.isArray(value) && value.every(primitive));
}
function readInput(value: unknown): CommandInputState {
  return isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, CommandInputValue] =>
          isInputValue(entry[1]),
        ),
      )
    : {};
}
function localPath(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\/(?:commands|plugins|history|settings)(?:\/|\?|$)/.test(value)
    ? value
    : undefined;
}

export function readDesktopSession(): DesktopSession {
  try {
    const current: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (isRecord(current))
      return {
        path: localPath(current.path),
        drafts: isRecord(current.drafts)
          ? Object.fromEntries(
              Object.entries(current.drafts).map(([id, input]) => [id, readInput(input)]),
            )
          : {},
      };
    // Import the previous UI selection once; preserve the legacy persisted data.
    const previous: unknown = JSON.parse(localStorage.getItem("tooldeck.desktop.ui") ?? "null");
    if (isRecord(previous) && isRecord(previous.state)) {
      const state = previous.state;
      const commandId =
        typeof state.selectedCommandId === "string" ? state.selectedCommandId : undefined;
      const path =
        state.view === "settings"
          ? "/settings"
          : state.view === "history"
            ? `/history${typeof state.historyCommandId === "string" ? `?command=${encodeURIComponent(state.historyCommandId)}` : ""}`
            : commandId
              ? commandPath(commandId)
              : typeof state.selectedPluginId === "string"
                ? pluginPath(state.selectedPluginId)
                : undefined;
      return { path, drafts: commandId ? { [commandId]: readInput(state.input) } : {} };
    }
  } catch {
    /* Unavailable storage or stale UI state must not prevent startup. */
  }
  return { drafts: {} };
}

export function writeDesktopSession(value: Partial<DesktopSession>) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readDesktopSession(), ...value }));
  } catch {
    /* Preferences and command history are persisted by the Desktop API. */
  }
}
