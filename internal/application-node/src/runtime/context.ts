import type { CreatedRuntime } from "@tooldeck/runtime-node";
import { Context } from "effect";

import type { ApplicationEffect } from "@/application/effect";

export interface ApplicationRuntime {
  readonly manifestIndex: Pick<
    CreatedRuntime["manifestIndex"],
    "getCommandOwner" | "getPlugin" | "hasPlugin" | "listCommands"
  >;
  readonly pluginManager: Pick<CreatedRuntime["pluginManager"], "getPluginRuntimeState">;
  readonly runCommand: CreatedRuntime["runCommand"];
}

export interface RuntimeService {
  current(): ApplicationEffect<ApplicationRuntime>;
  rebuild(): ApplicationEffect<void>;
  dispose(): ApplicationEffect<void>;
}

export class Runtime extends Context.Tag("@tooldeck/application-node/Runtime")<
  Runtime,
  RuntimeService
>() {}
