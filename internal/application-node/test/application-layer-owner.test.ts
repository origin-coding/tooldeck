import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { ApplicationLayerOwner } from "@/application/application-layer-owner";
import { runApplicationEffect } from "@/application/edge";
import { Commands, type CommandsService } from "@/commands/context";
import { History, type HistoryService } from "@/history/context";
import { Plugins, type PluginsService } from "@/plugins/context";
import { Preferences, type PreferencesService } from "@/preferences/context";

describe("ApplicationLayerOwner", () => {
  it("builds one scoped domain graph and releases it once", async () => {
    const calls: string[] = [];
    const owner = new ApplicationLayerOwner({
      makeLayer: () => createDomainLayer(calls),
    });

    await runApplicationEffect(owner.acquire());
    await expect(
      runApplicationEffect(owner.use(Commands, "runtime", (commands) => commands.list())),
    ).resolves.toEqual([]);
    await runApplicationEffect(owner.dispose());
    await runApplicationEffect(owner.dispose());

    expect(calls).toEqual(["acquire", "release"]);
    await expect(
      runApplicationEffect(owner.use(Commands, "runtime", (commands) => commands.list())),
    ).rejects.toMatchObject({
      code: "ERR_APPLICATION_DISPOSED",
      message: "Tooldeck application runtime is unavailable after disposal.",
    });
  });

  it("keeps services unavailable until the graph is acquired", async () => {
    const owner = new ApplicationLayerOwner({
      makeLayer: () => createDomainLayer([]),
    });

    await expect(
      runApplicationEffect(
        owner.use(History, "command history", (history) => history.listCommandRuns()),
      ),
    ).rejects.toMatchObject({
      code: "ERR_APPLICATION_NOT_STARTED",
      message: "Tooldeck application command history is unavailable before start.",
    });
  });
});

function createDomainLayer(calls: string[]) {
  const commands: CommandsService = Object.freeze({
    list: () => Effect.succeed([]),
    run: () => Effect.die("Unexpected command execution."),
  });
  const plugins: PluginsService = Object.freeze({
    list: () => Effect.succeed([]),
    rescan: () => Effect.succeed({ commands: [], plugins: [] }),
    setEnabled: () => Effect.die("Unexpected plugin mutation."),
    installPackage: () => Effect.die("Unexpected plugin mutation."),
    uninstall: () => Effect.die("Unexpected plugin mutation."),
    listDataResidues: () => Effect.succeed([]),
    purgeData: () => Effect.die("Unexpected plugin mutation."),
  });
  const preferences: PreferencesService = Object.freeze({
    list: () => Effect.succeed([]),
    get: () => Effect.die("Unexpected preference read."),
    set: () => Effect.die("Unexpected preference mutation."),
    delete: () => Effect.die("Unexpected preference mutation."),
  });
  const history: HistoryService = Object.freeze({
    listCommandRuns: () => Effect.succeed([]),
  });
  const lifetime = Layer.scopedDiscard(
    Effect.acquireRelease(
      Effect.sync(() => calls.push("acquire")),
      () => Effect.sync(() => calls.push("release")),
    ),
  );

  return Layer.mergeAll(
    Layer.succeed(Commands, commands),
    Layer.succeed(Plugins, plugins),
    Layer.succeed(Preferences, preferences),
    Layer.succeed(History, history),
    lifetime,
  );
}
