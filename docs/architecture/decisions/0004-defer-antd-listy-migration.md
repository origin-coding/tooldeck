# ADR 0004: Defer Ant Design Listy Migration

## Status

Proposed

## Date

2026-07-15

## Context

Tooldeck Desktop 当前使用 Ant Design 6.4.3。`CommandHistoryWorkbench` 和 `PluginWorkbench`
仍然使用已经废弃的 `List`，测试渲染这些界面时会输出弃用 warning。

Ant Design 官方文档把 `Listy` 定义为 `List` 的后继组件，但同时说明底层 `rc-listy` 仍在等待
核心维护者 review 和调整。当前稳定版 `antd` 尚未导出可直接迁移的 `Listy`。

在上游 API 未发布时，Tooldeck 可以继续使用兼容保留的 `List`、自行实现临时列表，或直接依赖
未稳定的 `rc-listy`。后两种方案都会在正式 `Listy` 发布后产生额外迁移和视觉回归风险。

## Decision

Tooldeck 1.3 暂时保留活动界面中的 Ant Design `List`，不直接依赖 `rc-listy`，也不为了消除
warning 创建一次性的自有兼容组件。

满足以下条件后启动迁移：

1. 稳定版 `antd` 正式导出 `Listy`，并提供 TypeScript 类型和迁移文档。
2. `Listy` 能覆盖当前列表项 title、description、actions、点击选择和 bordered presentation。
3. Tooldeck 可以同时完成组件测试、键盘交互检查和 Desktop 视觉 QA。

迁移时应一次替换所有活动 `List` 使用，并删除仅为旧 `List` 保留的样式或测试适配。测试中的
弃用 warning 在迁移前保留，不通过全局 warning suppression 隐藏。

## Consequences

1.3 不引入未稳定上游依赖，也避免先迁移到临时实现、随后再次迁移到 `Listy`。代价是当前测试
继续显示已知 warning，而且升级到移除 `List` 的 Ant Design major 版本前必须完成本 ADR 的
迁移条件检查。

依赖升级审查应把 `Listy` 可用性作为检查项；如果 `List` 在 `Listy` 可用前被实际移除，需要
重新评估语义化 HTML 列表作为 fallback，而不是无条件阻塞 Ant Design 安全升级。

## Alternatives Considered

### 立即改成普通 HTML 列表

可以消除 warning，但需要重新实现布局、actions 和主题一致性。当前没有必须立即移除 `List`
的功能或安全原因，因此不承担这次临时迁移成本。

### 直接依赖 `rc-listy`

上游仍在 review 和调整，API 与最终 Ant Design integration 可能变化，因此不采用。

### 屏蔽测试 warning

会让已知迁移债务失去可见性，也可能掩盖其他 Ant Design 弃用问题，因此不采用。

## References

- [Ant Design List documentation](https://ant.design/components/list/)
- [Tooldeck Desktop package](../../../apps/desktop/package.json)
- [`CommandHistoryWorkbench`](../../../apps/desktop/src/renderer/components/history/command-history-workbench.tsx)
- [`PluginWorkbench`](../../../apps/desktop/src/renderer/components/plugins/plugin-workbench.tsx)
