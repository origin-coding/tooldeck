# ADR 0003: CommandResult Status and Error Invariant

## Status

Accepted

## Date

2026-07-15

## Context

当前 `CommandResultV1` 用一个接口表达所有命令结果：`status` 可以是 `success` 或 `error`，
`error` 则始终是可选字段。runtime 只在 `error` 存在时校验其结构，因此当前契约接受：

- `status: "error"` 但没有 `error`。
- `status: "success"` 同时携带 `error`。

SDK 的 `ok` / `okText` 和 `fail` / `failText` helper 不会生成这些矛盾组合，但插件可以直接
返回对象，外部插件也已经通过公开的 `@tooldeck/protocol` 和 `@tooldeck/sdk-node` 编译。

Tooldeck 1.3 规划明确不改变 TPP v1 核心协议边界。直接把公开类型收紧为 discriminated union，
并让 runtime 拒绝旧形态，会形成 TypeScript source compatibility 和 runtime compatibility 的
破坏性变更，不应隐藏在 1.3 的代码质量清理中。

## Decision

1.3 保留现有 `CommandResultV1` 类型和 runtime 校验兼容性，不在本版本收紧公开协议。

宿主在兼容期内必须按 `status` 决定成功或失败；不能用 `error` 是否存在推断状态。对于
`status: "error"` 且没有可展示 block 或 error message 的结果，宿主应提供通用失败提示。
CLI 必须为 `status: "error"` 设置非零退出码，即使命令没有抛出异常。

下一次允许公开协议破坏性变更时，目标形态是：

```ts
interface SuccessfulCommandResultV1 {
  status: "success";
  blocks: ContentBlockV1[];
  error?: never;
}

interface FailedCommandResultV1 {
  status: "error";
  blocks: ContentBlockV1[];
  error: CommandErrorV1;
}

type CommandResultV1 = SuccessfulCommandResultV1 | FailedCommandResultV1;
```

届时 protocol 类型、runtime validator、plugin test host、SDK helper、内置插件、CLI、Desktop、
文档和兼容性测试必须在同一个变更中更新。具体 major/version 命名在执行该变更时决定，
本 ADR 不预先承诺 `CommandResultV2` 或 TPP v2。

## Consequences

1.3 不会破坏已经发布的插件作者类型和现有插件结果。CLI 和 Desktop 在兼容期内仍需处理
宽松结果形态，runtime 也暂时无法依靠类型不变量简化分支。

该问题被明确记录为协议债务，而不是被误判为普通未使用类型清理。未来收紧时需要发布说明、
迁移示例，并至少覆盖缺失 error、success 携带 error、合法 success 和合法 error 四类测试。

## Alternatives Considered

### 在 1.3 直接改为 discriminated union

类型更准确，但会在 minor release 中收紧公开 API，并让此前可运行的插件在新 runtime 中失败，
因此不采用。

### runtime 自动删除或补全矛盾字段

会静默改变插件返回数据，也可能掩盖插件实现错误。兼容期由宿主提供展示 fallback 更可预测。

### 永久保持宽松接口

会让每个宿主长期重复处理不可能状态，也无法实现真正统一的 `CommandResult` 语义，因此不采用。

## References

- [Tooldeck 1.3 Planning](../../planning/1.3.md)
- [TPP v1 Architecture](../tpp-v1.md)
- [`CommandResultV1` implementation](../../../packages/protocol/src/command.ts)
