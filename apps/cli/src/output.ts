import path from "node:path";

import Table from "cli-table3";
import pc from "picocolors";

export interface CommandListOutputRow {
  id: string;
  pluginId: string;
  title: string;
  description?: string;
}

export interface PluginListOutputRow {
  id: string;
  enabled: boolean;
  version: string;
  manifestPath: string;
  name: string;
}

export interface PreferenceListOutputRow {
  scope: string;
  key: string;
  value: unknown;
  updatedAt: number;
}

export function formatCommandList(commands: CommandListOutputRow[]): string {
  if (commands.length === 0) {
    return pc.dim("No commands found.");
  }

  const table = createPlainTable(["Command", "Title", "Plugin", "Description"]);

  for (const command of commands) {
    table.push([
      pc.cyan(command.id),
      command.title,
      pc.dim(command.pluginId),
      command.description ?? pc.dim("-"),
    ]);
  }

  return joinOutput(createCountLabel(commands.length, "command"), table.toString());
}

export function formatPluginList(plugins: PluginListOutputRow[]): string {
  if (plugins.length === 0) {
    return pc.dim("No plugins found.");
  }

  const table = createPlainTable(["Status", "Plugin", "Version", "Name", "Manifest"]);

  for (const plugin of plugins) {
    table.push([
      formatPluginStatus(plugin.enabled),
      pc.cyan(plugin.id),
      plugin.version,
      plugin.name,
      pc.dim(formatManifestPath(plugin.manifestPath)),
    ]);
  }

  return joinOutput(createCountLabel(plugins.length, "plugin"), table.toString());
}

export function formatPreferenceList(preferences: PreferenceListOutputRow[]): string {
  if (preferences.length === 0) {
    return pc.dim("No preferences found.");
  }

  const table = createPlainTable(["Scope", "Key", "Value", "Updated"]);

  for (const preference of preferences) {
    table.push([
      pc.dim(preference.scope),
      pc.cyan(preference.key),
      formatPreferenceValue(preference.value),
      new Date(preference.updatedAt).toISOString(),
    ]);
  }

  return joinOutput(createCountLabel(preferences.length, "preference"), table.toString());
}

export function formatPreferenceValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function createPlainTable(head: string[]): Table.Table {
  return new Table({
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: "  ",
    },
    head: head.map((value) => pc.bold(value)),
    style: {
      "padding-left": 0,
      "padding-right": 2,
      border: [],
      compact: true,
      head: [],
    },
    wordWrap: true,
  });
}

function createCountLabel(count: number, noun: string): string {
  const suffix = count === 1 ? noun : `${noun}s`;

  return pc.bold(`${count} ${suffix}`);
}

function formatPluginStatus(enabled: boolean): string {
  return enabled ? pc.green("enabled") : pc.yellow("disabled");
}

function formatManifestPath(manifestPath: string): string {
  const relativePath = path.relative(process.cwd(), manifestPath);

  if (relativePath && !path.isAbsolute(relativePath) && relativePath.length < manifestPath.length) {
    return relativePath;
  }

  return manifestPath;
}

function joinOutput(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("\n");
}
