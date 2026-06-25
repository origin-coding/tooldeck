import type { MaybePromise } from "./types";

export interface Disposable {
  dispose(): MaybePromise<void>;
}

export function toDisposable(dispose: () => MaybePromise<void>): Disposable {
  return { dispose };
}
