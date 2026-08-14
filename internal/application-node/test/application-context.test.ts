import type { CommandResult } from "@tooldeck/protocol";
import { Context, Effect } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { ApplicationEffect, ApplicationFailure } from "@/application/effect";
import { Commands, type CommandsService } from "@/commands/context";
import type { ApplicationCommand } from "@/commands/types";
import { History, type HistoryService } from "@/history/context";
import type { ApplicationCommandRun } from "@/history/types";
import { Plugins, type PluginsService } from "@/plugins/context";
import type {
  ApplicationPlugin,
  ApplicationPluginCatalog,
  ApplicationPluginDataResidue,
  ApplicationPluginInstallResult,
  ApplicationPluginPurgeResult,
  ApplicationPluginUninstallResult,
} from "@/plugins/types";
import { Preferences, type PreferencesService } from "@/preferences/context";
import type { ApplicationPreference } from "@/preferences/types";
import { type ApplicationRuntime, Runtime, type RuntimeService } from "@/runtime/context";
import * as storageModule from "@/storage";
import {
  type ApplicationRepositories,
  ApplicationStorage,
  type ApplicationStorageService,
} from "@/storage/context";

describe("application Context contracts", () => {
  it("defines four narrow domain services whose operations return ApplicationEffect", async () => {
    const commands: CommandsService = {
      list: () => Effect.succeed([]),
      run: () => Effect.succeed(successfulCommandResult()),
    };
    const program = Effect.gen(function* () {
      const service = yield* Commands;

      return yield* service.list();
    });

    expectTypeOf<keyof CommandsService>().toEqualTypeOf<"list" | "run">();
    expectTypeOf<CommandsService>().toEqualTypeOf<Context.Tag.Service<typeof Commands>>();
    expectTypeOf<keyof PluginsService>().toEqualTypeOf<
      | "list"
      | "rescan"
      | "setEnabled"
      | "installPackage"
      | "uninstall"
      | "listDataResidues"
      | "purgeData"
    >();
    expectTypeOf<PluginsService>().toEqualTypeOf<Context.Tag.Service<typeof Plugins>>();
    expectTypeOf<keyof PreferencesService>().toEqualTypeOf<"list" | "get" | "set" | "delete">();
    expectTypeOf<PreferencesService>().toEqualTypeOf<Context.Tag.Service<typeof Preferences>>();
    expectTypeOf<keyof HistoryService>().toEqualTypeOf<"listCommandRuns">();
    expectTypeOf<HistoryService>().toEqualTypeOf<Context.Tag.Service<typeof History>>();
    expectTypeOf<ReturnType<CommandsService["list"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationCommand[]>
    >();
    expectTypeOf<ReturnType<CommandsService["run"]>>().toEqualTypeOf<
      ApplicationEffect<CommandResult>
    >();
    expectTypeOf<ReturnType<PluginsService["list"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPlugin[]>
    >();
    expectTypeOf<ReturnType<PluginsService["rescan"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPluginCatalog>
    >();
    expectTypeOf<ReturnType<PluginsService["setEnabled"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPlugin>
    >();
    expectTypeOf<ReturnType<PluginsService["installPackage"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPluginInstallResult>
    >();
    expectTypeOf<ReturnType<PluginsService["uninstall"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPluginUninstallResult>
    >();
    expectTypeOf<ReturnType<PluginsService["listDataResidues"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPluginDataResidue[]>
    >();
    expectTypeOf<ReturnType<PluginsService["purgeData"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPluginPurgeResult>
    >();
    expectTypeOf<ReturnType<PreferencesService["list"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPreference[]>
    >();
    expectTypeOf<ReturnType<PreferencesService["get"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPreference>
    >();
    expectTypeOf<ReturnType<PreferencesService["set"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationPreference>
    >();
    expectTypeOf<ReturnType<PreferencesService["delete"]>>().toEqualTypeOf<
      ApplicationEffect<void>
    >();
    expectTypeOf<ReturnType<HistoryService["listCommandRuns"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationCommandRun[]>
    >();
    expectTypeOf(program).toEqualTypeOf<
      Effect.Effect<ApplicationCommand[], ApplicationFailure, Commands>
    >();

    await expect(
      Effect.runPromise(program.pipe(Effect.provideService(Commands, commands))),
    ).resolves.toEqual([]);
  });

  it("keeps Runtime private and limited to current, rebuild, and dispose", () => {
    expectTypeOf<keyof RuntimeService>().toEqualTypeOf<"current" | "rebuild" | "dispose">();
    expectTypeOf<keyof ApplicationRuntime>().toEqualTypeOf<
      "manifestIndex" | "pluginManager" | "runCommand"
    >();
    expectTypeOf<keyof ApplicationRuntime["manifestIndex"]>().toEqualTypeOf<
      "getCommandOwner" | "getPlugin" | "hasPlugin" | "listCommands"
    >();
    expectTypeOf<
      keyof ApplicationRuntime["pluginManager"]
    >().toEqualTypeOf<"getPluginRuntimeState">();
    expectTypeOf<ReturnType<RuntimeService["current"]>>().toEqualTypeOf<
      ApplicationEffect<ApplicationRuntime>
    >();
    expect(Runtime.key).toBe("@tooldeck/application-node/Runtime");
  });

  it("exposes one repository graph and transactions without exposing database details", () => {
    expectTypeOf<keyof ApplicationRepositories>().toEqualTypeOf<
      "commandRuns" | "preferences" | "plugins" | "pluginInstalls" | "pluginStates" | "pluginKv"
    >();
    expectTypeOf<keyof ApplicationStorageService>().toEqualTypeOf<
      "repositories" | "withImmediateTransaction"
    >();
    expect(ApplicationStorage.key).toBe("@tooldeck/application-node/ApplicationStorage");
    expect(Plugins.key).toBe("@tooldeck/application-node/Plugins");
    expect(Preferences.key).toBe("@tooldeck/application-node/Preferences");
    expect(History.key).toBe("@tooldeck/application-node/History");
    expect(Object.keys(storageModule)).toEqual(["makeStorageLive"]);
  });
});

function successfulCommandResult(): CommandResult {
  return { status: "success", blocks: [] };
}
