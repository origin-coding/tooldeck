# ADR 0007: ApplicationError-only Application Facade

## Status

Accepted

## Date

2026-07-24

## Context

Tooldeck 1.3 的错误类位于 `shared`，CLI 等跨 package 消费者会使用 `instanceof
TooldeckError`。Private packages 被分别 bundle 后可能存在多份 class identity，使跨 bundle
判断脆弱。Runtime、database、plugin management、CLI 和 IPC 对错误的所有权与转换位置也不够
明确。

Tooldeck 1.4 将 runtime 和 application 分成两个私有层，并可能在内部试点 Effect。Apps 需要
稳定的 Promise/DTO facade，不能理解 RuntimeError、Effect Exit/Cause 或具体 storage/package
错误。

## Decision

Runtime 和 application 分别拥有 typed error：

```text
RuntimeError
  manifest / command / validation / activation / host / runtime lifecycle

ApplicationError
  database / preferences / install / uninstall / purge / product policy
```

ApplicationError 是 CLI 和 Desktop main 唯一需要识别的 thrown error：

```ts
type ApplicationErrorSource = "application" | "runtime";

class ApplicationError extends Error {
  readonly _tag = "ApplicationError";
  readonly source: ApplicationErrorSource;
  readonly code: ApplicationErrorCode;
  readonly details?: JsonObject;
}
```

Application 内部组合时可以让 `RuntimeError | ApplicationError` 传播。在 application 增加产品
语义时，或在 Promise facade 的统一出口，把 RuntimeError 通过 `fromRuntimeError()` 转换为：

```text
ApplicationError
source = "runtime"
code/message/details = preserved
cause = original RuntimeError
```

未提前转换的 RuntimeError 必须在 facade 出口完成转换。Application public surface、CLI、
Desktop 和生成的 `.d.ts` 不引用 RuntimeError 或 RuntimeErrorCode。

ApplicationErrorCode 显式声明 apps 可观察的 runtime code，而不是导出/引用 RuntimeErrorCode。
Runtime 增加可观察 code 时必须显式更新 application mapping 和 tests。

跨 package 分支使用稳定 shape guard：

```ts
function isApplicationError(error: unknown, code?: ApplicationErrorCode): error is ApplicationError;
```

Guard 检查 `_tag`、`source`、`code`、message 和 Error shape，不只依赖 class identity。同一
package 内部仍可使用 `instanceof`。

分别提供 `toRuntimeError()`、`toApplicationError()` 和 `fromRuntimeError()`。已知 typed error
原样保留；普通 Error 和非 Error thrown value 安全归一化；只有增加明确层级语义时才包装；包装
保留 cause；相邻层不重复包装。

Transport serializer 输出：

```ts
interface ApplicationErrorTransport {
  tag: "ApplicationError";
  source: "application" | "runtime";
  code: ApplicationErrorCode;
  message: string;
  details?: JsonObject;
}
```

Transport 不包含 stack、raw cause、Effect Cause/FiberFailure、credentials、token 或不必要文件
内容。Diagnostic serialization 可以额外包含 stack、operation context 和有限 cause summary，
但两者必须明确区分。

插件主动返回的 `CommandResult.error` 保持独立业务通道，不统一转换为 ApplicationError。

## Consequences

Apps 可以在不知道 runtime implementation 和 Effect 的情况下稳定映射 CLI exit code 与 IPC
contract。`source` 表达错误所有权，`code` 表达稳定可观察类别，runtime code 不会因为跨层包装
降级为 `ERR_UNKNOWN`。

ApplicationErrorCode 与 RuntimeErrorCode 会有少量显式重复。这是有意的 facade 防泄漏设计；
新增 code 需要同步映射和测试，换取公开类型不跨层耦合。

Runtime/application 各自拥有 normalization，不能再建立无所有权的 shared errors package。
Cleanup 和 rollback 必须保留主 cause、尝试全部 cleanup，并用 JSON-safe details 记录聚合失败。

Effect pilot 如被采用，统一 edge runner 必须把 typed failure、defect 和 interruption 映射为
ApplicationError，不能把 Exit、Cause 或 FiberFailure 暴露给 apps。

## Alternatives Considered

### Apps 同时识别 RuntimeError 与 ApplicationError

会泄漏 runtime private API，并让 CLI/Desktop 分别处理跨层转换。

### 保留全局 TooldeckError

继续模糊错误所有权，且不能解决跨 bundle class identity。

### 只使用普通 Error message

会丢失稳定 code、source 和 JSON-safe details，无法可靠驱动 CLI/IPC 行为。

### 直接序列化 Error 或 Effect Cause

会泄漏 stack、cause tree、实现细节或敏感数据，且 transport 不稳定。

### 只依赖 `instanceof`

在多 bundle/class copy 场景不可靠，因此只允许 package 内部使用。

## References

- [Tooldeck 1.4 Planning](../../planning/1.4.md)
- [Package Boundaries and Dependency Layers](../../planning/1.4/01-package-boundaries.md)
- [Effect Pilot](../../planning/1.4/02-effect-pilot.md)
- [ADR 0005](./0005-public-packages-and-internal-implementation.md)
- [Issue #28](https://github.com/origin-coding/tooldeck/issues/28)
