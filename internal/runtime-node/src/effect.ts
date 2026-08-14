import { Cause, Effect, Exit, Option } from "effect";

import { isRuntimeError, RuntimeError, toRuntimeError } from "@/errors/error";

export type RuntimeEffect<A> = Effect.Effect<A, RuntimeError>;

export function tryRuntimePromise<A>(options: {
  try: (signal: AbortSignal) => PromiseLike<A>;
  catch: (error: unknown) => RuntimeError;
}): RuntimeEffect<A> {
  return Effect.tryPromise({
    try: (signal) => options.try(signal),
    catch: options.catch,
  });
}

export function tryRuntimeBoundaryPromise<A>(
  operation: (signal: AbortSignal) => PromiseLike<A>,
): RuntimeEffect<A> {
  return Effect.tryPromise({
    try: operation,
    catch: (error) => error,
  }).pipe(
    Effect.catchAll((error) => (isRuntimeError(error) ? Effect.fail(error) : Effect.die(error))),
  );
}

export async function runRuntimeEffectPromise<A>(effect: RuntimeEffect<A>): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw runtimeErrorFromCause(exit.cause);
}

export function runRuntimeEffectSync<A>(effect: RuntimeEffect<A>): A {
  const exit = Effect.runSyncExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw runtimeErrorFromCause(exit.cause);
}

export function runtimeErrorFromCause(cause: Cause.Cause<RuntimeError>): RuntimeError {
  const failure = Cause.failureOption(cause);

  if (Option.isSome(failure)) {
    return failure.value;
  }

  const defect = Cause.dieOption(cause);

  if (Option.isSome(defect)) {
    return toRuntimeError(defect.value);
  }

  return new RuntimeError({
    code: "ERR_UNKNOWN",
    message: "Runtime operation was interrupted.",
  });
}
