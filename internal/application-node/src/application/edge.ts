import type { RuntimeError } from "@tooldeck/runtime-node";
import { Cause, Effect, Exit, Option } from "effect";

import { ApplicationError, fromRuntimeError, toApplicationError } from "@/errors/application-error";

export async function runApplicationOperation<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toApplicationError(error);
  }
}

export function runApplicationEffect<T>(effect: Effect.Effect<T, ApplicationError>): Promise<T> {
  return runMappedEffect(effect, (error) => error, "Application operation was interrupted.");
}

export async function runRuntimeEffect<T>(effect: Effect.Effect<T, RuntimeError>): Promise<T> {
  return runMappedEffect(effect, fromRuntimeError, "Runtime operation was interrupted.");
}

async function runMappedEffect<T, E>(
  effect: Effect.Effect<T, E>,
  mapFailure: (error: E) => ApplicationError,
  interruptionMessage: string,
): Promise<T> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isSome(failure)) {
    throw mapFailure(failure.value);
  }

  const defect = Cause.dieOption(exit.cause);

  if (Option.isSome(defect)) {
    throw toApplicationError(defect.value);
  }

  throw new ApplicationError({
    source: "application",
    code: "ERR_UNKNOWN",
    message: interruptionMessage,
  });
}
