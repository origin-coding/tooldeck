import { runApplicationEffect } from "@/application/edge";
import type { PluginsService } from "@/plugins/context";
import type {
  ApplicationPlugin,
  ApplicationPluginCatalog,
  ApplicationPluginDataResidue,
  ApplicationPluginFacade,
  ApplicationPluginInstallResult,
  ApplicationPluginLocaleRequest,
  ApplicationPluginPurgeResult,
  ApplicationPluginUninstallResult,
} from "@/plugins/facade-types";

export class ApplicationPlugins implements ApplicationPluginFacade {
  constructor(private readonly service: PluginsService) {}

  list(request: ApplicationPluginLocaleRequest = {}): Promise<ApplicationPlugin[]> {
    return runApplicationEffect(this.service.list(request));
  }

  rescan(request: ApplicationPluginLocaleRequest = {}): Promise<ApplicationPluginCatalog> {
    return runApplicationEffect(this.service.rescan(request));
  }

  setEnabled(
    pluginId: string,
    enabled: boolean,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPlugin> {
    return runApplicationEffect(this.service.setEnabled(pluginId, enabled, request));
  }

  installPackage(
    packagePath: string,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPluginInstallResult> {
    return runApplicationEffect(this.service.installPackage(packagePath, request));
  }

  uninstall(
    pluginId: string,
    request: ApplicationPluginLocaleRequest = {},
  ): Promise<ApplicationPluginUninstallResult> {
    return runApplicationEffect(this.service.uninstall(pluginId, request));
  }

  listDataResidues(): Promise<ApplicationPluginDataResidue[]> {
    return runApplicationEffect(this.service.listDataResidues());
  }

  purgeData(pluginId: string): Promise<ApplicationPluginPurgeResult> {
    return runApplicationEffect(this.service.purgeData(pluginId));
  }
}
