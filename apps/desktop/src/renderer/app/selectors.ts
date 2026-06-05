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

export function filterCommands(commands: DesktopCommand[], query: string): DesktopCommand[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return commands;
  }

  return commands.filter((command) =>
    [command.id, command.title, command.description, command.pluginId]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalized)),
  );
}

export function filterPlugins(plugins: DesktopPlugin[], query: string): DesktopPlugin[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return plugins;
  }

  return plugins.filter((plugin) =>
    [plugin.id, plugin.name, plugin.version, plugin.manifestPath]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
