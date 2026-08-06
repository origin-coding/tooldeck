import { Effect, ExecutionStrategy, Scope } from "effect";

export function createTestScope(): Scope.CloseableScope {
  return Effect.runSync(Scope.make(ExecutionStrategy.sequential));
}
