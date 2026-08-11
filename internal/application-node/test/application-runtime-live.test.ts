import type { CommandResult } from "@tooldeck/protocol";
import { RuntimeError, type CreatedRuntime } from "@tooldeck/runtime-node";
import { Cause, Deferred, Effect, Exit, Fiber } from "effect";
import { describe, expect, it, vi } from "vitest";

import { runApplicationEffect } from "@/application/edge";
import { Runtime } from "@/application/runtime-context";
import { makeRuntimeLive } from "@/application/runtime-live";
import type { CapturedApplicationCleanupFailure } from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";

describe("RuntimeLive", () => {
  it("acquires one runtime and exposes only application runtime capabilities", async () => {
    const created = createRuntimeFixture("initial");

    const result = await runApplicationEffect(
      Effect.gen(function* () {
        const service = yield* Runtime;
        const first = yield* service.current();
        const second = yield* service.current();

        return {
          sameRuntime: first === second,
          frozenService: Object.isFrozen(service),
          frozenRuntime: Object.isFrozen(first),
          runtimeKeys: Object.keys(first).sort(),
          manifestIndexKeys: Object.keys(first.manifestIndex).sort(),
          pluginManagerKeys: Object.keys(first.pluginManager).sort(),
          commandOwner: first.manifestIndex.getCommandOwner("command.initial"),
        };
      }).pipe(
        Effect.provide(makeRuntimeLive({ createRuntime: () => Effect.succeed(created.runtime) })),
      ),
    );

    expect(result).toEqual({
      sameRuntime: true,
      frozenService: true,
      frozenRuntime: true,
      runtimeKeys: ["manifestIndex", "pluginManager", "runCommand"],
      manifestIndexKeys: ["getCommandOwner", "getPlugin", "hasPlugin", "listCommands"],
      pluginManagerKeys: ["getPluginRuntimeState"],
      commandOwner: "initial",
    });
    expect(created.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the previous runtime before installing a rebuilt runtime", async () => {
    const calls: string[] = [];
    const first = createRuntimeFixture("first", () => calls.push("dispose:first"));
    const second = createRuntimeFixture("second", () => calls.push("dispose:second"));
    const runtimes = [first.runtime, second.runtime];

    const result = await runApplicationEffect(
      Effect.gen(function* () {
        const service = yield* Runtime;
        const before = yield* service.current();

        yield* service.rebuild();

        const after = yield* service.current();
        return [
          before.manifestIndex.getCommandOwner("command.first"),
          after.manifestIndex.getCommandOwner("command.second"),
        ];
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () =>
              Effect.sync(() => {
                const runtime = runtimes.shift();
                calls.push(`create:${runtime === first.runtime ? "first" : "second"}`);

                if (!runtime) {
                  throw new Error("Unexpected runtime creation.");
                }

                return runtime;
              }),
          }),
        ),
      ),
    );

    expect(result).toEqual(["first", "second"]);
    expect(calls).toEqual(["create:first", "dispose:first", "create:second", "dispose:second"]);
  });

  it("serializes rebuild and dispose lifecycle changes", async () => {
    const rebuildEntered = await Effect.runPromise(Deferred.make<void>());
    const releaseRebuild = await Effect.runPromise(Deferred.make<void>());
    const calls: string[] = [];
    const first = createRuntimeFixture("first", () => calls.push("dispose:first"));
    const second = createRuntimeFixture("second", () => calls.push("dispose:second"));
    let creation = 0;

    await runApplicationEffect(
      Effect.gen(function* () {
        const service = yield* Runtime;
        const rebuildFiber = yield* Effect.fork(service.rebuild());

        yield* Deferred.await(rebuildEntered);
        const disposeFiber = yield* Effect.fork(service.dispose());
        yield* Effect.yieldNow();
        yield* Deferred.succeed(releaseRebuild, undefined);
        yield* Fiber.join(rebuildFiber);
        yield* Fiber.join(disposeFiber);

        const current = yield* Effect.either(service.current());
        expect(current).toMatchObject({
          _tag: "Left",
          left: { code: "ERR_APPLICATION_NOT_STARTED" },
        });
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () => {
              creation += 1;

              if (creation === 1) {
                calls.push("create:first");
                return Effect.succeed(first.runtime);
              }

              calls.push("create:second:start");
              return Deferred.succeed(rebuildEntered, undefined).pipe(
                Effect.zipRight(Deferred.await(releaseRebuild)),
                Effect.tap(() => Effect.sync(() => calls.push("create:second:end"))),
                Effect.as(second.runtime),
              );
            },
          }),
        ),
      ),
    );

    expect(calls).toEqual([
      "create:first",
      "dispose:first",
      "create:second:start",
      "create:second:end",
      "dispose:second",
    ]);
  });

  it("allows an explicitly disposed runtime to be rebuilt", async () => {
    const first = createRuntimeFixture("first");
    const second = createRuntimeFixture("second");
    const runtimes = [first.runtime, second.runtime];

    await runApplicationEffect(
      Effect.gen(function* () {
        const service = yield* Runtime;

        yield* service.dispose();
        const unavailable = yield* Effect.either(service.current());
        expect(unavailable).toMatchObject({
          _tag: "Left",
          left: {
            code: "ERR_APPLICATION_NOT_STARTED",
            message: "Tooldeck application runtime is unavailable before start.",
          },
        });

        yield* service.dispose();
        yield* service.rebuild();

        const current = yield* service.current();
        expect(current.manifestIndex.getCommandOwner("command.second")).toBe("second");
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () => Effect.succeed(runtimes.shift()!),
          }),
        ),
      ),
    );

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("leaves no current runtime when rebuilding fails", async () => {
    const first = createRuntimeFixture("first");
    const rebuildError = new RuntimeError({
      code: "ERR_PLUGIN_LOAD_FAILED",
      message: "forced runtime rebuild failure",
    });
    let creation = 0;

    await runApplicationEffect(
      Effect.gen(function* () {
        const service = yield* Runtime;
        const rebuild = yield* Effect.either(service.rebuild());

        expect(rebuild).toMatchObject({ _tag: "Left", left: rebuildError });
        const unavailable = yield* Effect.either(service.current());
        expect(unavailable).toMatchObject({
          _tag: "Left",
          left: { code: "ERR_APPLICATION_NOT_STARTED" },
        });
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () => {
              creation += 1;
              return creation === 1 ? Effect.succeed(first.runtime) : Effect.fail(rebuildError);
            },
          }),
        ),
      ),
    );

    expect(first.dispose).toHaveBeenCalledOnce();
  });

  it("reports finalizer failures through the Layer cleanup sink", async () => {
    const disposeError = new RuntimeError({
      code: "ERR_COMMAND_FAILED",
      message: "forced RuntimeLive disposal failure",
    });
    const created = createRuntimeFixture("failing", undefined, Effect.fail(disposeError));
    const cleanupFailures: CapturedApplicationCleanupFailure[] = [];

    await expect(
      runApplicationEffect(
        Effect.gen(function* () {
          yield* Runtime;
        }).pipe(
          Effect.provide(
            makeRuntimeLive({
              createRuntime: () => Effect.succeed(created.runtime),
              onCleanupFailure: (failure) => cleanupFailures.push(failure),
            }),
          ),
        ),
      ),
    ).resolves.toBeUndefined();
    expect(cleanupFailures.map((failure) => failure.diagnostic)).toEqual([
      {
        phase: "cleanup",
        step: "runtime.dispose",
        context: {},
        error: {
          source: "runtime",
          code: "ERR_COMMAND_FAILED",
          message: "forced RuntimeLive disposal failure",
        },
      },
    ]);
  });

  it("does not swallow finalizer failures without a cleanup sink", async () => {
    const disposeError = new RuntimeError({
      code: "ERR_COMMAND_FAILED",
      message: "forced unhandled RuntimeLive disposal failure",
    });
    const created = createRuntimeFixture("failing", undefined, Effect.fail(disposeError));
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* Runtime;
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () => Effect.succeed(created.runtime),
          }),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.defects(exit.cause))).toEqual([
        expect.objectContaining({
          source: "application",
          code: "ERR_UNKNOWN",
          message: "Tooldeck runtime did not dispose cleanly.",
          details: {
            cleanupFailures: [
              {
                phase: "cleanup",
                step: "runtime.dispose",
                context: {},
                error: {
                  source: "runtime",
                  code: "ERR_COMMAND_FAILED",
                  message: "forced unhandled RuntimeLive disposal failure",
                },
              },
            ],
          },
        }),
      ]);
    }
  });

  it("preserves a primary operation failure when runtime cleanup also fails", async () => {
    const primaryError = new ApplicationError({
      source: "application",
      code: "ERR_INVALID_ARGUMENT",
      message: "runtime-backed operation failed",
    });
    const disposeError = new RuntimeError({
      code: "ERR_COMMAND_FAILED",
      message: "forced runtime cleanup failure",
    });
    const created = createRuntimeFixture("failing", undefined, Effect.fail(disposeError));
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* Runtime;
        return yield* Effect.fail(primaryError);
      }).pipe(
        Effect.provide(
          makeRuntimeLive({
            createRuntime: () => Effect.succeed(created.runtime),
          }),
        ),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      expect(Array.from(Cause.failures(exit.cause))).toEqual([primaryError]);
      expect(Array.from(Cause.defects(exit.cause))).toEqual([
        expect.objectContaining({
          source: "application",
          code: "ERR_INVALID_ARGUMENT",
          message: "runtime-backed operation failed",
          details: {
            cleanupFailures: [
              expect.objectContaining({
                phase: "cleanup",
                step: "runtime.dispose",
              }),
            ],
          },
          cause: expect.objectContaining({
            message: "Application operation failed and the runtime did not dispose cleanly.",
            errors: [primaryError, expect.objectContaining({ source: "runtime" })],
          }),
        }),
      ]);
    }
  });
});

function createRuntimeFixture(
  id: string,
  onDispose?: () => void,
  disposeEffect: ReturnType<CreatedRuntime["dispose"]> = Effect.void,
): { runtime: CreatedRuntime; dispose: ReturnType<typeof vi.fn> } {
  const dispose = vi.fn(() => Effect.sync(() => onDispose?.()).pipe(Effect.andThen(disposeEffect)));
  const result: CommandResult = { status: "success", blocks: [] };

  return {
    runtime: {
      manifestIndex: {
        getCommandOwner: () => id,
        getPlugin: () => undefined,
        hasPlugin: () => true,
        listCommands: () => [],
      } as unknown as CreatedRuntime["manifestIndex"],
      pluginManager: {
        getPluginRuntimeState: () => "inactive",
      } as unknown as CreatedRuntime["pluginManager"],
      runCommand: () => Effect.succeed({ result, input: {} }),
      dispose,
    } as unknown as CreatedRuntime,
    dispose,
  };
}
