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

export interface PluginsService {
  list(request?: ApplicationPluginLocaleRequest): ApplicationEffect<ApplicationPlugin[]>;
  rescan(request?: ApplicationPluginLocaleRequest): ApplicationEffect<ApplicationPluginCatalog>;
  setEnabled(
    pluginId: string,
    enabled: boolean,
    request?: ApplicationPluginLocaleRequest,
  ): ApplicationEffect<ApplicationPlugin>;
  installPackage(
    packagePath: string,
    request?: ApplicationPluginLocaleRequest,
  ): ApplicationEffect<ApplicationPluginInstallResult>;
  uninstall(
    pluginId: string,
    request?: ApplicationPluginLocaleRequest,
  ): ApplicationEffect<ApplicationPluginUninstallResult>;
  listDataResidues(): ApplicationEffect<ApplicationPluginDataResidue[]>;
  purgeData(pluginId: string): ApplicationEffect<ApplicationPluginPurgeResult>;
}

export class Plugins extends Context.Tag("@tooldeck/application-node/Plugins")<
  Plugins,
  PluginsService
>() {}
