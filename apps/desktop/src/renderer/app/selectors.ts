import type { DesktopCommand, DesktopPlugin } from "@/shared/desktop-api";

export function resolveSelectedCommandId(
  commands: DesktopCommand[],
  selectedCommandId: string | undefined,
): string | undefined {
  if (selectedCommandId && commands.some((command) => command.id === selectedCommandId)) {
    return selectedCommandId;
  }

  return commands[0]?.id;
}

export function resolveSelectedPluginId(
  plugins: DesktopPlugin[],
  selectedPluginId: string | undefined,
  selectedCommand: DesktopCommand | undefined,
): string | undefined {
  if (selectedPluginId && plugins.some((plugin) => plugin.id === selectedPluginId)) {
    return selectedPluginId;
  }

  if (
    selectedCommand?.pluginId &&
    plugins.some((plugin) => plugin.id === selectedCommand.pluginId)
  ) {
    return selectedCommand.pluginId;
  }

  return plugins[0]?.id;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
