import { consola } from "consola";

import {
  formatPluginInstall,
  formatPluginList,
  formatPluginPurge,
  formatPluginUninstall,
} from "./output";
import type {
  InstalledCliPlugin,
  ListedCliPlugin,
  PurgedCliPlugin,
  UninstalledCliPlugin,
} from "./plugin-operations";
import type { CliOutputFormat } from "./preferences";

export function printPluginList(
  plugins: ListedCliPlugin[],
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugins, null, 2));
    return;
  }

  consola.log(formatPluginList(plugins));
}

export function printPluginInstall(
  plugin: InstalledCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginInstall(plugin));
}

export function printPluginUninstall(
  plugin: UninstalledCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginUninstall(plugin));
}

export function printPluginPurge(
  plugin: PurgedCliPlugin,
  outputFormat: CliOutputFormat = "text",
): void {
  if (outputFormat === "json") {
    consola.log(JSON.stringify(plugin, null, 2));
    return;
  }

  consola.log(formatPluginPurge(plugin));
}
