import {
  makeStateMachine,
  mapStateMachineTransitionErrors,
  type MappedStateMachine,
  type StateEventName,
  type StateTransitionError,
  type StateTransitionTable,
} from "@tooldeck/state-machine";
import { Cause, Effect, Exit } from "effect";

import {
  type ApplicationEffect,
  type ApplicationFailure,
  runApplicationEffect,
} from "@/application/effect";
import { ApplicationError } from "@/errors/error";

export type ApplicationLifecycleState =
  | "created"
  | "starting"
  | "started"
  | "disposing"
  | "disposed";

interface ApplicationLifecycleEvents {
  readonly startRequested: void;
  readonly startSucceeded: void;
  readonly startRolledBack: void;
  readonly disposeRequested: void;
  readonly disposeCompleted: void;
}

type ApplicationLifecycleMachine = MappedStateMachine<
  ApplicationLifecycleState,
  ApplicationLifecycleEvents,
  ApplicationError
>;

const applicationLifecycleTransitions: StateTransitionTable<
  ApplicationLifecycleState,
  ApplicationLifecycleEvents
> = {
  created: {
    startRequested: "starting",
    disposeRequested: "disposing",
  },
  starting: {
    startSucceeded: "started",
    startRolledBack: "created",
  },
  started: {
    disposeRequested: "disposing",
  },
  disposing: {
    disposeCompleted: "disposed",
  },
  disposed: {},
};

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

export function makeApplicationLifecycleMachine(): Effect.Effect<ApplicationLifecycleMachine> {
  return Effect.map(
    makeStateMachine<ApplicationLifecycleState, ApplicationLifecycleEvents>({
      initialState: "created",
      transitions: applicationLifecycleTransitions,
    }),
    (machine) => mapStateMachineTransitionErrors(machine, applicationErrorFromStateTransition),
  );
}

function applicationErrorFromStateTransition(
  error: StateTransitionError<
    ApplicationLifecycleState,
    StateEventName<ApplicationLifecycleEvents>
  >,
): ApplicationError {
  const message =
    error._tag === "InvalidStateTransition"
      ? "Invalid application lifecycle transition"
      : "Blocked application lifecycle transition";

  return new ApplicationError({
    source: "application",
    code: "ERR_INVALID_ARGUMENT",
    message: `${message}: ${error.state} -> ${error.event}`,
    details: {
      state: error.state,
      event: error.event,
    },
  });
}
