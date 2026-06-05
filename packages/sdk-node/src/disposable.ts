import type { MaybePromise } from "@tooldeck/shared";

export interface Disposable {
  dispose(): MaybePromise<void>;
}

export function toDisposable(dispose: () => MaybePromise<void>): Disposable {
  return { dispose };
}
