import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";
import type {
  CommandRunRepository,
  PluginInstallRepository,
  PluginKvRepository,
  PluginRepository,
  PluginStateRepository,
  PreferenceRepository,
} from "@/storage/repositories";

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
