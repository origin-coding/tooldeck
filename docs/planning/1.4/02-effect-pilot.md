# Effect Pilot in Internal Node Packages

本文定义 Effect 在 Tooldeck 1.4 私有 Node 实现中的有限试点、边界、评估标准和退出路径。

## Status

```text
Pilot approved; final adoption scope intentionally undecided.
```

Effect 的最终采用范围不在本规划阶段写成 Accepted ADR。Application pilot 必须根据实际证据
得出“扩大、缩小或退出”的明确结论。

## Boundary

允许直接依赖 Effect：

```text
internal/runtime-node
internal/application-node
```

不得引入 Effect：

```text
packages/*
plugins/*
Desktop renderer/preload
```

CLI 和 Desktop main 只通过 `application-node` 的 Promise/DTO facade 使用产品能力，不直接操作
Effect、Layer、Scope、Exit 或 Cause。

Runtime 可以向 application 暴露内部 Effect-first API，避免私有 package 之间进行无意义的
Effect → Promise → Effect 往返：

```ts
interface RuntimeService {
  runCommand(input: RuntimeCommandInput): Effect.Effect<CommandResult, RuntimeError>;
  rescan(input: RuntimeScanInput): Effect.Effect<RuntimeScanResult, RuntimeError>;
  dispose(): Effect.Effect<void, RuntimeError>;
}
```

Application 对 apps 仍提供普通 Promise use cases：

```ts
interface TooldeckApplication {
  start(): Promise<void>;
  runCommand(input: RunCommandInput): Promise<CommandResult>;
  rescan(input?: RescanInput): Promise<RescanResult>;
  dispose(): Promise<void>;
}
```

Application API 是产品用例，不是 runtime API 的一对一代理。

## Goals

- 验证 typed error channel 是否减少错误分支遗漏和重复包装。
- 验证 Scope、finalizer 和 Layer 是否简化 runtime/application 生命周期。
- 保持已有 cleanup、rollback、CommandResult、history 和 transport 语义。
- 建立 RuntimeError → ApplicationError 的单一 facade 出口。
- 为 Zod / Effect Schema 二选一提供真实实施证据。
- 得出明确的 Effect 保留或退出结论，不长期保留并行实现。

## Error Model

RuntimeError 用于 manifest、command、activation、host、validation 和 runtime disposal。
ApplicationError 用于 database、preferences、plugin management 和产品策略。

Application 内部允许：

```ts
Effect.Effect<Result, RuntimeError | ApplicationError, Requirements>;
```

只有在 application 增加产品语义或到达 apps facade 出口时，才把 RuntimeError 转为：

```text
ApplicationError
source = "runtime"
```

现有错误类可以直接进入 Effect typed error channel。第一阶段不要求迁移为
`Data.TaggedError` 或 `Schema.TaggedError`，避免同时改变错误形态与执行模型。

不受控 Promise 使用带 `catch` 的 `Effect.tryPromise`，不得让通用 `UnknownException` 长期传播。
`mapError` 只用于有所有权的边界转换；`catchTag` / `catchIf` 用于选择性恢复；`tapError`
只做 diagnostic。

## Application Edge Runner

Runtime/application 内部保持 Effect 组合，统一在 application Promise facade 运行程序。
建议基于 `Effect.runPromiseExit()`：

```text
Success       -> return value
typed failure -> normalize to ApplicationError and reject
defect        -> ERR_UNKNOWN with diagnostic cause
interruption  -> ERR_UNKNOWN with internal interrupted diagnostic
```

1.4 不新增公开 cancellation code。FiberFailure、Exit 和 Cause 不得进入 CLI、IPC、history 或
renderer。

## Cleanup and Rollback Semantics

Effect Scope、`acquireRelease`、`onExit` 和 finalizer 只有在保持以下语义时才可采用：

- 所有 cleanup 都要尝试，不在首个失败时停止。
- 主操作错误保留为主要 cause。
- cleanup error 不覆盖主错误。
- 多个 cleanup error 转为 JSON-safe `details.cleanupErrors`。
- 只有 cleanup 失败时，cleanup error 才成为主要错误。
- Interruption 不跳过 finalizer。
- Finalizer 保持现有反向释放顺序。
- Raw Effect Cause 不做 transport serialization。

Install/uninstall 的业务补偿不能简单等同于 Scope：

- Staging directory 可以是 scoped resource。
- 已提交的 plugin directory 成功后不能自动释放。
- Database、catalog 和 directory rollback 保持显式步骤。
- `cleanupPending` 继续表示逻辑成功后的 retained cleanup，不转成普通 failure。

## Failure Channels

保持三条独立通道：

```text
plugin business failure
  -> CommandResult.error

recoverable runtime/application failure
  -> Effect typed error channel

defect or interruption
  -> Effect Cause, normalized at the application edge
```

插件返回的 `CommandResult.error.code` 继续允许任意字符串，不得全部转换为 ApplicationError。

## Pilot Stages

### Stage 0: Behavior baseline

固化 RuntimeError、activation/deactivation、subscription 反向释放、dispose-all、database
open/close、Desktop startup/shutdown、CLI outcome/history/cleanup、install/uninstall rollback 和
CommandResult history serialization。

### Stage 1: Runtime pilot

在 `internal/runtime-node` 中试点：

- Node plugin load 和 activate/deactivate。
- Subscription disposal 与 host registry disposal。
- Runtime resource Scope。
- RuntimeError typed channel。
- Unknown Promise rejection normalization。

不迁移 public SDK Promise API、通用 state machine、pending activation 并发去重、Ajv 或新的
runtime kind。

### Stage 2: Application lifecycle pilot

在 `internal/application-node` 中试点：

- Database/runtime acquisition and release。
- Application start/dispose。
- CLI scoped helper 与 Desktop long-lived application。
- Partial startup cleanup。
- RuntimeError/ApplicationError 联合通道。
- Promise facade 与统一 edge runner。

### Stage 3: Use-case pilot

至少覆盖：

```text
application.runCommand
  -> enabled-state gate
  -> runtime.runCommand
  -> history write
  -> cleanup
  -> application error boundary
```

并选择 install 或 uninstall 之一验证业务补偿流程。

### Stage 4: Decide and converge

结论必须是：

- 保留并扩大 Effect；或
- 只保留有明确收益的窄范围；或
- 完全撤回试点并恢复普通 Promise。

不得长期保留两套并行实现。

## Retention Criteria

- Lifecycle、cleanup 和依赖组织更清晰。
- Typed error channel 能暴露遗漏分支。
- Failure injection 测试更容易。
- RuntimeError/ApplicationError 不重复包装。
- Apps 和公开 package 不出现 Effect 类型。
- 现有错误码、CommandResult 和 history 行为兼容。
- 最终构建只有一份 Effect runtime。
- Bundle、startup 和 typecheck 成本可接受。
- 团队可以用少量明确规则维护。

## Exit or Reduction Criteria

- 大量代码只是 Promise/Effect 往返包装。
- Runtime 与 application 仍频繁丢失 typed error。
- Cleanup/rollback 更难理解。
- 完成组合必须向 apps 或公开 package 暴露 Effect。
- Cause 无法稳定映射到既有错误行为。
- Artifact 出现多份 Effect runtime。
- Build、startup 或 typecheck 成本明显增加。
- 依赖大量不稳定 platform API。
- 普通 TypeScript 实现更短、更直接且有同等测试保障。

## Build Constraints

引入 Effect 前必须避免 `runtime-node` 和 `application-node` 各自内联一份 runtime。可选：

- Internal package 输出普通 TypeScript ESM，不预打包第三方依赖；或
- Internal build externalize `effect`，由 CLI/Desktop 最终 bundle 统一处理。

两个 internal package 声明相同直接版本。验收检查 CLI/Desktop artifact 中的 Effect
implementation 数量。

## Implementation Issues

1. [#32 Pilot Effect for plugin runtime lifecycle](https://github.com/origin-coding/tooldeck/issues/32)
2. [#33 Pilot Effect for application lifecycle and error boundaries](https://github.com/origin-coding/tooldeck/issues/33)

#32 受 runtime consolidation #29 阻塞。#33 受 application consolidation #30 和 runtime
pilot #32 阻塞，并负责记录最终保留或退出结论。

## Acceptance Criteria

- Runtime Effect API 只由 application-node 消费。
- Apps 不导入 runtime-node，不接触 RuntimeError、Effect、Exit、Cause 或 Layer。
- Application 对 apps 只暴露 Promise/DTO 和 ApplicationError。
- 已知 runtime code 不降级为 `ERR_UNKNOWN`。
- ApplicationError 保留 `source`、code、message、details 和 cause。
- Edge runner 不泄漏 FiberFailure。
- Cleanup 尝试全部资源并保留主错误。
- Effect Cause 不进入 IPC/history。
- CLI/Desktop 与公开插件可观察行为保持。
- 公开 tarball/`.d.ts` 不包含 Effect，最终应用 artifact 不含多份 Effect runtime。
- 试点留下明确结论，未采用实现和依赖进入规划 6 cleanup inventory。

## Non-goals

- 全仓库 Effect 改造。
- 将公开 SDK 改为 Effect API。
- 在本规划中选择 Zod 或 Effect Schema。
- 替换 Ajv。
- 新增 retry、timeout、公开 cancellation 或 observable interruption code。
- 全面重命名错误码或修改 CommandResult。
- 引入不稳定的 Effect platform API。
