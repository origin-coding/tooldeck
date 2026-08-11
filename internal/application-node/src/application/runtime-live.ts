import type { CreatedRuntime } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit, Layer } from "effect";

import { applicationErrorFromCause } from "@/application/edge";
import {
  type ApplicationEffect,
  type ApplicationFailure,
  tryApplicationSync,
} from "@/application/effect";
import {
  type ApplicationRuntime,
  Runtime,
  type RuntimeService,
} from "@/application/runtime-context";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";

export interface RuntimeLiveOptions {
  readonly createRuntime: () => ApplicationEffect<CreatedRuntime>;
  readonly onCleanupFailure?: (failure: CapturedApplicationCleanupFailure) => void;
}

interface AcquiredRuntimeService {
  readonly service: RuntimeService;
  readonly close: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<void>;
}

interface OwnedRuntime {
  readonly created: CreatedRuntime;
  readonly exposed: ApplicationRuntime;
}

export function makeRuntimeLive(
  options: RuntimeLiveOptions,
): Layer.Layer<Runtime, ApplicationFailure> {
  return Layer.scoped(
    Runtime,
    Effect.acquireRelease(acquireRuntimeService(options), (acquired, exit) =>
      acquired.close(exit),
    ).pipe(Effect.map(({ service }) => service)),
  );
}

function acquireRuntimeService(
  options: RuntimeLiveOptions,
): ApplicationEffect<AcquiredRuntimeService> {
  return Effect.gen(function* () {
    const lifecyclePermit = yield* Effect.makeSemaphore(1);
    let currentRuntime: OwnedRuntime | undefined;
    let closed = false;

    const releaseCurrent = (): ApplicationEffect<void> => {
      const runtime = currentRuntime;
      currentRuntime = undefined;

      return runtime
        ? tryApplicationSync(() => runtime.created.dispose()).pipe(Effect.flatten)
        : Effect.void;
    };

    const current: RuntimeService["current"] = () =>
      lifecyclePermit.withPermits(1)(
        Effect.suspend(() => {
          if (currentRuntime) {
            return Effect.succeed(currentRuntime.exposed);
          }

          return Effect.fail(runtimeUnavailableError(closed));
        }),
      );

    const rebuild: RuntimeService["rebuild"] = () =>
      lifecyclePermit.withPermits(1)(
        Effect.gen(function* () {
          if (closed) {
            return yield* Effect.fail(runtimeUnavailableError(true));
          }

          yield* releaseCurrent();

          const created = yield* tryApplicationSync(options.createRuntime).pipe(Effect.flatten);
          currentRuntime = {
            created,
            exposed: exposeApplicationRuntime(created),
          };
        }),
      );

    const dispose: RuntimeService["dispose"] = () =>
      lifecyclePermit.withPermits(1)(Effect.suspend(releaseCurrent));

    const close = (exit: Exit.Exit<unknown, unknown>): Effect.Effect<void> =>
      lifecyclePermit.withPermits(1)(
        Effect.uninterruptible(
          Effect.gen(function* () {
            closed = true;
            const runtimeExit = yield* Effect.exit(releaseCurrent());

            if (Exit.isSuccess(runtimeExit)) {
              return;
            }

            const runtimeError = applicationErrorFromCause(runtimeExit.cause);
            const cleanupFailure = captureApplicationCleanupFailure({
              phase: "cleanup",
              step: "runtime.dispose",
              context: {},
              error: runtimeError,
            });

            if (options.onCleanupFailure) {
              yield* Effect.sync(() => options.onCleanupFailure?.(cleanupFailure));
              return;
            }

            const cleanupError = Exit.isFailure(exit)
              ? combinePrimaryAndCleanupFailures(
                  applicationErrorFromCause(exit.cause as Cause.Cause<ApplicationFailure>),
                  [cleanupFailure],
                  "Application operation failed and the runtime did not dispose cleanly.",
                )
              : createApplicationCleanupError("Tooldeck runtime did not dispose cleanly.", [
                  cleanupFailure,
                ]);

            return yield* Effect.die(cleanupError);
          }),
        ),
      );

    yield* rebuild();

    return {
      service: Object.freeze({ current, rebuild, dispose }),
      close,
    };
  });
}

function exposeApplicationRuntime(runtime: CreatedRuntime): ApplicationRuntime {
  const runCommand: ApplicationRuntime["runCommand"] = (options) => runtime.runCommand(options);

  return Object.freeze({
    manifestIndex: Object.freeze({
      getCommandOwner: runtime.manifestIndex.getCommandOwner.bind(runtime.manifestIndex),
      getPlugin: runtime.manifestIndex.getPlugin.bind(runtime.manifestIndex),
      hasPlugin: runtime.manifestIndex.hasPlugin.bind(runtime.manifestIndex),
      listCommands: runtime.manifestIndex.listCommands.bind(runtime.manifestIndex),
    }),
    pluginManager: Object.freeze({
      getPluginRuntimeState: runtime.pluginManager.getPluginRuntimeState.bind(
        runtime.pluginManager,
      ),
    }),
    runCommand,
  });
}

function runtimeUnavailableError(disposed: boolean): ApplicationError {
  return new ApplicationError({
    source: "application",
    code: disposed ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
    message: disposed
      ? "Tooldeck application runtime is unavailable after disposal."
      : "Tooldeck application runtime is unavailable before start.",
  });
}
