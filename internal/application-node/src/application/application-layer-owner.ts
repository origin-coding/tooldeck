import { Cause, Context, Effect, ExecutionStrategy, Exit, Layer, Scope } from "effect";

import { applicationErrorFromCause } from "@/application/edge";
import type { ApplicationEffect, ApplicationFailure } from "@/application/effect";
import type { ApplicationServices } from "@/application/services";
import {
  captureApplicationCleanupFailure,
  type CapturedApplicationCleanupFailure,
  combinePrimaryAndCleanupFailures,
  createApplicationCleanupError,
} from "@/errors/application-cleanup";
import { ApplicationError } from "@/errors/application-error";

export interface ApplicationLayerOwnerOptions {
  readonly makeLayer: (
    onCleanupFailure: (failure: CapturedApplicationCleanupFailure) => void,
  ) => Layer.Layer<ApplicationServices, ApplicationFailure>;
}

export class ApplicationLayerOwner {
  private context?: Context.Context<ApplicationServices>;
  private scope?: Scope.CloseableScope;
  private disposed = false;
  private readonly cleanupFailures: CapturedApplicationCleanupFailure[] = [];

  constructor(private readonly options: ApplicationLayerOwnerOptions) {}

  acquire(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationLayerOwner) {
      const scope = yield* Scope.make(ExecutionStrategy.sequential);
      this.scope = scope;
      this.cleanupFailures.length = 0;
      this.context = yield* Layer.buildWithScope(
        this.options.makeLayer((failure) => this.cleanupFailures.push(failure)),
        scope,
      );
    });
  }

  rollbackFailedStart(cause: Cause.Cause<ApplicationFailure>): ApplicationEffect<never> {
    return this.rollback(cause);
  }

  dispose(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationLayerOwner) {
      const scope = this.scope;
      this.clear();
      this.disposed = true;

      if (scope) {
        yield* Scope.close(scope, Exit.succeed(undefined));
      }

      const cleanupFailures = this.takeCleanupFailures();

      if (cleanupFailures.length > 0) {
        return yield* Effect.fail(
          createApplicationCleanupError("Application resource cleanup failed.", cleanupFailures),
        );
      }
    });
  }

  use<I extends ApplicationServices, S, A>(
    tag: Context.Tag<I, S>,
    resourceName: string,
    operation: (service: S) => ApplicationEffect<A>,
  ): ApplicationEffect<A> {
    return Effect.suspend(() => {
      if (!this.context) {
        return Effect.fail(this.unavailableError(resourceName));
      }

      return operation(Context.get(this.context, tag));
    });
  }

  private rollback(cause: Cause.Cause<ApplicationFailure>): ApplicationEffect<never> {
    return Effect.gen(this, function* (this: ApplicationLayerOwner) {
      const primaryError = applicationErrorFromCause(cause);
      const scope = this.scope;
      this.clear();

      if (scope) {
        yield* Scope.close(scope, Exit.failCause(cause));
      }

      const cleanupFailures = this.takeCleanupFailures();

      if (cleanupFailures.length > 0) {
        const cleanupError = createApplicationCleanupError(
          "Application resource cleanup failed.",
          cleanupFailures,
        );

        return yield* Effect.fail(
          combinePrimaryAndCleanupFailures(
            primaryError,
            [
              captureApplicationCleanupFailure({
                phase: "cleanup",
                step: "applicationResources.dispose",
                context: {},
                error: cleanupError,
              }),
            ],
            "Application startup failed and partial resources could not be fully released.",
          ),
        );
      }

      return yield* Effect.failCause(cause);
    });
  }

  private clear(): void {
    this.context = undefined;
    this.scope = undefined;
  }

  private takeCleanupFailures(): CapturedApplicationCleanupFailure[] {
    return this.cleanupFailures.splice(0);
  }

  private unavailableError(resourceName: string): ApplicationError {
    return new ApplicationError({
      source: "application",
      code: this.disposed ? "ERR_APPLICATION_DISPOSED" : "ERR_APPLICATION_NOT_STARTED",
      message: this.disposed
        ? `Tooldeck application ${resourceName} is unavailable after disposal.`
        : `Tooldeck application ${resourceName} is unavailable before start.`,
    });
  }
}
