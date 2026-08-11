import type { CreatedRuntime } from "@tooldeck/runtime-node";

import type { CommandInputPreprocessor } from "@/application/adapters";
import type { ApplicationEffect } from "@/application/effect";
import type { ApplicationLifecycleCoordinator } from "@/application/lifecycle-coordinator";
import type { ApplicationResourceOwner } from "@/application/resource-owner";
import type { PluginManagementService } from "@/plugins/management";
import type { CommandRunRepository, PluginRepository, PreferenceRepository } from "@/storage";

export interface TooldeckApplicationContextOptions {
  readonly preprocessCommandInput: CommandInputPreprocessor;
  readonly lifecycle: ApplicationLifecycleCoordinator;
  readonly resources: ApplicationResourceOwner;
}

export class TooldeckApplicationContext {
  readonly preprocessCommandInput: CommandInputPreprocessor;

  private readonly lifecycle: ApplicationLifecycleCoordinator;
  private readonly resources: ApplicationResourceOwner;

  constructor(options: TooldeckApplicationContextOptions) {
    this.preprocessCommandInput = options.preprocessCommandInput;
    this.lifecycle = options.lifecycle;
    this.resources = options.resources;
  }

  start(): Promise<void> {
    return this.lifecycle.start();
  }

  dispose(): Promise<void> {
    return this.lifecycle.dispose();
  }

  startEffect(): ApplicationEffect<void> {
    return this.lifecycle.startEffect();
  }

  disposeEffect(): ApplicationEffect<void> {
    return this.lifecycle.disposeEffect();
  }

  rebuildRuntime(): ApplicationEffect<void> {
    return this.resources.rebuildRuntime();
  }

  disposeRuntime(): ApplicationEffect<void> {
    return this.resources.disposeRuntime();
  }

  requireRuntime(): CreatedRuntime {
    return this.resources.requireRuntime();
  }

  requireCommandRuns(): CommandRunRepository {
    return this.resources.requireCommandRuns();
  }

  requirePreferences(): PreferenceRepository {
    return this.resources.requirePreferences();
  }

  requirePlugins(): PluginRepository {
    return this.resources.requirePlugins();
  }

  requirePluginManagement(): PluginManagementService {
    return this.resources.requirePluginManagement();
  }
}
