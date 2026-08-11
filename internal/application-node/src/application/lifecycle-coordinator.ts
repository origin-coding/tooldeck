import { Cause, Effect, Exit } from "effect";

import {
  type ApplicationLifecycleMachine,
  makeApplicationLifecycleMachine,
} from "@/application/application-lifecycle";
import { runApplicationEffect } from "@/application/edge";
import type { ApplicationEffect, ApplicationFailure } from "@/application/effect";
import { ApplicationError } from "@/errors/application-error";

export interface ApplicationLifecycleResources {
  acquire(): ApplicationEffect<void>;
  rollbackFailedStart(cause: Cause.Cause<ApplicationFailure>): ApplicationEffect<never>;
  dispose(): ApplicationEffect<void>;
}

export class ApplicationLifecycleCoordinator {
  private machine?: ApplicationLifecycleMachine;
  private startPromise?: Promise<void>;
  private disposePromise?: Promise<void>;

  constructor(private readonly resources: ApplicationLifecycleResources) {}

  start(): Promise<void> {
    if (this.disposePromise) {
      return runApplicationEffect(
        Effect.fail(
          new ApplicationError({
            source: "application",
            code: "ERR_APPLICATION_DISPOSED",
            message: "Tooldeck application is disposing or has already been disposed.",
          }),
        ),
      );
    }

    if (!this.startPromise) {
      const startPromise = runApplicationEffect(this.startEffect());
      this.startPromise = startPromise;

      void startPromise.catch(() => {
        if (this.startPromise === startPromise && !this.disposePromise) {
          this.startPromise = undefined;
        }
      });
    }

    return this.startPromise;
  }

  dispose(): Promise<void> {
    this.disposePromise ??= this.disposeAfterStart();
    return this.disposePromise;
  }

  startEffect(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationLifecycleCoordinator) {
      const machine = yield* this.getMachine();
      const state = yield* machine.state;

      if (state === "started") {
        return;
      }

      yield* machine.dispatch({ type: "startRequested" });

      const acquisitionExit = yield* Effect.exit(this.resources.acquire());

      if (Exit.isFailure(acquisitionExit)) {
        const rollbackExit = yield* Effect.exit(
          this.resources.rollbackFailedStart(acquisitionExit.cause),
        );

        yield* machine.dispatch({ type: "startRolledBack" });

        if (Exit.isFailure(rollbackExit)) {
          return yield* Effect.failCause(rollbackExit.cause);
        }

        return yield* Effect.die(
          new Error("Application failed to start but resource rollback unexpectedly succeeded."),
        );
      }

      yield* machine.dispatch({ type: "startSucceeded" });
    });
  }

  disposeEffect(): ApplicationEffect<void> {
    return Effect.gen(this, function* (this: ApplicationLifecycleCoordinator) {
      const machine = yield* this.getMachine();
      const state = yield* machine.state;

      if (state === "disposed" || state === "disposing") {
        return;
      }

      yield* machine.dispatch({ type: "disposeRequested" });

      const disposeExit = yield* Effect.exit(this.resources.dispose());

      yield* machine.dispatch({ type: "disposeCompleted" });

      if (Exit.isFailure(disposeExit)) {
        return yield* Effect.failCause(disposeExit.cause);
      }
    });
  }

  private getMachine(): Effect.Effect<ApplicationLifecycleMachine> {
    return Effect.suspend(() => {
      if (this.machine) {
        return Effect.succeed(this.machine);
      }

      return makeApplicationLifecycleMachine().pipe(
        Effect.tap((machine) =>
          Effect.sync(() => {
            this.machine = machine;
          }),
        ),
      );
    });
  }

  private async disposeAfterStart(): Promise<void> {
    try {
      await this.startPromise;
    } catch {
      // A failed start already releases partial resources before rejecting.
    }

    return runApplicationEffect(this.disposeEffect());
  }
}
