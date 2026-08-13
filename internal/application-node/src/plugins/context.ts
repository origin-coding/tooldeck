import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  ApplicationPlugin,
  ApplicationPluginCatalog,
  ApplicationPluginDataResidue,
  ApplicationPluginInstallResult,
  ApplicationPluginLocaleRequest,
  ApplicationPluginPurgeResult,
  ApplicationPluginUninstallResult,
} from "@/plugins/facade-types";

export class Plugins extends Context.Tag("@tooldeck/application-node/Plugins")<
  Plugins,
  {
    readonly list: (
      request?: ApplicationPluginLocaleRequest,
    ) => ApplicationEffect<ApplicationPlugin[]>;
    readonly rescan: (
      request?: ApplicationPluginLocaleRequest,
    ) => ApplicationEffect<ApplicationPluginCatalog>;
    readonly setEnabled: (
      pluginId: string,
      enabled: boolean,
      request?: ApplicationPluginLocaleRequest,
    ) => ApplicationEffect<ApplicationPlugin>;
    readonly installPackage: (
      packagePath: string,
      request?: ApplicationPluginLocaleRequest,
    ) => ApplicationEffect<ApplicationPluginInstallResult>;
    readonly uninstall: (
      pluginId: string,
      request?: ApplicationPluginLocaleRequest,
    ) => ApplicationEffect<ApplicationPluginUninstallResult>;
    readonly listDataResidues: () => ApplicationEffect<ApplicationPluginDataResidue[]>;
    readonly purgeData: (pluginId: string) => ApplicationEffect<ApplicationPluginPurgeResult>;
  }
>() {}

export type PluginsService = Context.Tag.Service<typeof Plugins>;
