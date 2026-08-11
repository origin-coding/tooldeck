import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type { CommandRunRepository } from "@/storage/repositories/command-runs";
import type { PluginInstallRepository } from "@/storage/repositories/plugin-installs";
import type { PluginKvRepository } from "@/storage/repositories/plugin-kv";
import type { PluginStateRepository } from "@/storage/repositories/plugin-states";
import type { PluginRepository } from "@/storage/repositories/plugins";
import type { PreferenceRepository } from "@/storage/repositories/preferences";

export interface ApplicationRepositories {
  readonly commandRuns: CommandRunRepository;
  readonly preferences: PreferenceRepository;
  readonly plugins: PluginRepository;
  readonly pluginInstalls: PluginInstallRepository;
  readonly pluginStates: PluginStateRepository;
  readonly pluginKv: PluginKvRepository;
}

export interface ApplicationStorageService {
  readonly repositories: ApplicationRepositories;
  withImmediateTransaction<A>(operation: () => A): ApplicationEffect<A>;
}

export class ApplicationStorage extends Context.Tag(
  "@tooldeck/application-node/ApplicationStorage",
)<ApplicationStorage, ApplicationStorageService>() {}
