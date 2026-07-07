import { existsSync } from "node:fs";
import path from "node:path";

import {
  CommandService,
  ManifestIndex,
  PluginManager,
  type PluginScanSource,
} from "@tooldeck/runtime-node";
import { NodePluginHost } from "@tooldeck/host-node";
import {
  CommandRunRepository,
  PluginKvRepository,
  PluginRepository,
  PreferenceRepository,
  type TooldeckDatabase,
} from "@tooldeck/storage";

import type { TooldeckDesktopServiceOptions } from "./types";

export class TooldeckDesktopServiceContext {
  readonly workspaceRoot: string;
  readonly pluginsRoot: string;
  readonly installedPluginsDir: string;
  readonly pluginSources: PluginScanSource[];
  readonly storagePath: string;
  database?: TooldeckDatabase;
  commandRuns?: CommandRunRepository;
  preferences?: PreferenceRepository;
  plugins?: PluginRepository;
  pluginKv?: PluginKvRepository;
  pluginHost?: NodePluginHost;
  pluginManager?: PluginManager;
  commandService?: CommandService;
  manifestIndex?: ManifestIndex;

  constructor(options: TooldeckDesktopServiceOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
    this.pluginsRoot = options.pluginsRoot ?? path.join(this.workspaceRoot, "plugins");
    this.storagePath =
      options.storagePath ?? path.join(this.workspaceRoot, ".data", "tooldeck.sqlite");
    this.installedPluginsDir =
      options.installedPluginsDir ?? path.join(path.dirname(this.storagePath), "installed-plugins");
    this.pluginSources =
      options.pluginSources ??
      [
        {
          kind: "builtin" as const,
          path: this.pluginsRoot,
        },
        {
          kind: "installed" as const,
          path: this.installedPluginsDir,
        },
        ...(options.pluginDirs ?? []).map((pluginDir) => ({
          kind: "external" as const,
          path: pluginDir,
        })),
      ];
  }

  requireCommandService(): CommandService {
    if (!this.commandService) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandService;
  }

  requirePluginManager(): PluginManager {
    if (!this.pluginManager) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.pluginManager;
  }

  requireManifestIndex(): ManifestIndex {
    if (!this.manifestIndex) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.manifestIndex;
  }

  requireCommandRuns(): CommandRunRepository {
    if (!this.commandRuns) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.commandRuns;
  }

  requirePreferences(): PreferenceRepository {
    if (!this.preferences) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.preferences;
  }

  requirePlugins(): PluginRepository {
    if (!this.plugins) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.plugins;
  }

  requirePluginKv(): PluginKvRepository {
    if (!this.pluginKv) {
      throw new Error("Tooldeck desktop service has not started.");
    }

    return this.pluginKv;
  }
}

function findWorkspaceRoot(): string {
  let current = process.cwd();

  for (;;) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
