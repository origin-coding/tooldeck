import { isRuntimeError, type RuntimeError } from "@tooldeck/runtime-node";
import { Effect } from "effect";

import {
  isApplicationError,
  toApplicationError,
  type ApplicationError,
} from "@/errors/application-error";

export type ApplicationFailure = ApplicationError | RuntimeError;

export type ApplicationEffect<A> = Effect.Effect<A, ApplicationFailure>;

export function tryApplicationPromise<A>(
  operation: (signal: AbortSignal) => PromiseLike<A>,
): ApplicationEffect<A> {
  return Effect.tryPromise({
    try: operation,
    catch: toApplicationFailure,
  });
}

export function tryApplicationSync<A>(operation: () => A): ApplicationEffect<A> {
  return Effect.try({
    try: operation,
    catch: toApplicationFailure,
  });
}

export function toApplicationFailure(error: unknown): ApplicationFailure {
  if (isApplicationError(error) || isRuntimeError(error)) {
    return error;
  }

  return toApplicationError(error);
}
