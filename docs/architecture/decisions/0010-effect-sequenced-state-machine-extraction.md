# ADR 0010: Effect-sequenced State Machine Extraction

## Status

Accepted

## Date

2026-07-31

## Context

`internal/runtime-node` 当前包含一个通用 TypeScript `StateMachine`，并基于它实现 plugin
registry、plugin runtime 和 capability invocation lifecycle。这个实现仍依赖
`@tooldeck/sdk-node` 的 `MaybePromise`，并在非法或被 guard 阻止的 transition 上固定抛出
`RuntimeError`，因此它不是 runtime/application 都能直接使用的中立内核。

`internal/application-node` 同时需要管理：

```text
created -> starting -> started -> disposing -> disposed
```

但 Application lifecycle 不只是 transition table。它还负责 database/runtime acquisition、
partial startup rollback、反向 cleanup、主错误保留以及并发 start/dispose 的 single-flight
语义。Application lifecycle failure 属于 `ApplicationError`，不能因为复用 runtime 的状态机而
被错误标记为 runtime failure。

Tooldeck 1.4 已规划先在 runtime/application 中试点 Effect，并验证 Scope、Layer、typed error
channel 和 interruption。若在 Effect 之前抽取 Promise-oriented 状态机，可能在 Effect
composition 落地后再次重写 guard、action、failure 与 cancellation 语义。

## Decision

状态机库的抽取安排在 Effect runtime/application pilot 完成并确定保留方式之后实施。在此之前：

- Application 保留局部 lifecycle 控制，不直接导入 runtime 的通用 `StateMachine`。
- Runtime 现有状态机保持 runtime 私有，不作为 application reuse contract。
- 不为了提前共享而建立新的通用 `shared` package。

Effect 结论支持继续实施时，新增一个职责单一的 private state-machine library。该 library：

- 不依赖 `runtime-node`、`application-node`、`sdk-node`、Electron、SQLite 或 UI。
- 不抛出 `RuntimeError` 或 `ApplicationError`。
- 由 Effect pilot 的结论决定 transition、guard、action 和 failure 的最终内部表示。
- 不向公开 package、Application Promise/DTO facade、CLI 或 Desktop renderer 泄漏 Effect
  类型。
- 只拥有状态与 transition 规则，不拥有 database/runtime 等具体资源。

Runtime 和 Application 分别建立有所有权的 wrapper：

```text
neutral state-machine result/failure
  -> runtime lifecycle wrapper
  -> RuntimeError

neutral state-machine result/failure
  -> application lifecycle wrapper
  -> ApplicationError
```

Application start/dispose 的 single-flight、resource acquisition、rollback 和 cleanup 仍由
Application lifecycle service 负责。状态机只验证和记录 transition，不能代替资源管理。

如果 Effect pilot 最终退出，则在退出结论之后重新评估 Promise-only 中立状态机，而不是直接把
当前绑定 RuntimeError 的实现提升为共享 contract。

## Consequences

状态机抽取不会抢在 Effect failure/resource model 之前固化错误 API，避免先抽取后重写。Runtime
与 Application 保持各自错误所有权，公开边界继续只暴露 RuntimeError 或 ApplicationError 的
既定所有者接口。

短期内 Application 与 runtime 会保留不同的 lifecycle 实现；这是明确的临时状态，不代表允许
长期复制通用状态机。Effect 结论之后必须实施本 ADR，或以新的 ADR 说明为何不再抽取。

新增 private package 会增加一个 workspace/build boundary，因此实施时必须证明 runtime 和
application 都有真实消费者，并增加依赖方向、生成 `.d.ts` 和最终 bundle 中 Effect
implementation 数量检查。

## Alternatives Considered

### Application 直接使用 runtime StateMachine

会把 Application lifecycle failure 变成 RuntimeError，并让 application 依赖 runtime 的错误
实现细节，因此不采用。

### 在 Effect 之前立即抽取 Promise 状态机

可以较早消除代码重复，但 guard、action、failure、interruption 和 resource scope 很可能在
Effect pilot 后改变，形成二次迁移，因此不采用。

### Application 永久维护独立状态机

会让通用 transition 行为和测试在两个 internal package 中长期漂移，不符合收敛私有实现的目标。

## References

- [Effect Pilot in Internal Node Packages](../../planning/1.4/02-effect-pilot.md)
- [ADR 0005: Public Packages and Internal Implementation](./0005-public-packages-and-internal-implementation.md)
- [ADR 0007: ApplicationError-only Application Facade](./0007-application-error-only-facade.md)
- [Issue #32](https://github.com/origin-coding/tooldeck/issues/32)
- [Issue #33](https://github.com/origin-coding/tooldeck/issues/33)
