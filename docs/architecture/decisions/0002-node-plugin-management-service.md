# ADR 0002: Node Plugin Management Service

## Status

Accepted

## Date

2026-07-10

## Context

Tooldeck 1.3 需要让 CLI 和 Desktop 共享本地 `.tdplugin` 安装、卸载、catalog 同步和 enabled 状态管理规则。现有包已经分别提供 package container、manifest scanning 和 SQLite repository 能力，但 CLI 和 Desktop 中存在重复的 scan-to-storage 编排。

把安装逻辑放入 CLI 会阻碍 Desktop 复用；把 SQLite 和文件安装编排放入 `@tooldeck/runtime-node` 或 `@tooldeck/host-node`，会破坏 runtime、host 与产品存储实现之间的边界。

## Decision

新增私有包 `@tooldeck/plugin-management-node`，作为 Tooldeck Node 产品实现中的插件管理 application service。

`docs/planning/1.3.md` 和 `docs/planning/1.3/` 已作为版本规划记录冻结，不回写实现阶段的边界澄清。规划与当前实现之间的修正和补充以本 ADR 及后续 ADR 为准。

依赖方向为：

```text
@tooldeck/plugin-package + @tooldeck/runtime-node + @tooldeck/storage
  -> @tooldeck/plugin-management-node
  -> CLI / Desktop
```

该包负责：

- 扫描结果与 SQLite plugin catalog 的同步。
- enabled 状态修改前的 catalog 协调。
- `.tdplugin` 安装的 staging、冲突检测、落盘、记录写入、rescan 和失败补偿。
- installed plugin 卸载的路径校验、文件隔离、记录删除、rescan 和失败补偿。
- 为 CLI 和 Desktop 返回宿主无关的结构化结果。

现有包继续保留各自底层职责：

- `@tooldeck/plugin-package` 负责 package format、校验、解包和 digest。
- `@tooldeck/runtime-node` 负责 manifest scanning、`ManifestIndex` 和来源冲突诊断。
- `@tooldeck/storage` 负责 schema、migration 和 repository CRUD。
- `@tooldeck/host-node` 负责加载和运行 Node 插件。

安装、扫描和卸载不得 import runtime entry 或激活插件。CLI 参数解析、输出格式化、Electron IPC、renderer 交互和 runtime 重建继续留在对应应用中。

`uninstall` 以 `plugin_installs` 为管理资格的权威来源。记录存在但安装目录已经丢失时，卸载作为修复操作删除残留记录并刷新 catalog。卸载保留 plugin state、plugin scoped KV 和 command history。

卸载在安装记录删除和 catalog 刷新成功后视为逻辑提交。隔离目录的最终清理失败时，不得把可能已经部分删除的目录恢复为 active install；服务返回 `cleanupPending` 和清理错误供宿主报告，残留隔离目录留待后续清理。

`purge` 不在本服务的首个 PR 中实现。后续由独立 issue 添加完整的“未安装”前置检查和状态清理编排。

### 后续实现：Retained-data purge

1.3 后续 PR 已在本服务中实现 purge。`@tooldeck/plugin-management-node` 现在还负责：

- 列出已卸载且仍保留 `plugin_states` 或 plugin scoped KV 的 plugin id。
- 在 SQLite transaction 中删除目标 plugin id 的 state 和 KV。
- 在目标仍有 install record 时拒绝 purge。
- 为 CLI 和 Desktop 返回宿主无关的 purge summary。

Purge 继续保留 command history，也不扩大本服务的 runtime hosting 或 UI 职责。

## Consequences

CLI 和 Desktop 可以共享同一套安装与状态不变量，而 package、runtime 和 storage 包保持单一职责。

该包是 Node 和 Tooldeck 产品实现专用的私有包，不属于 TPP 协议或插件作者 SDK。它会同时协调文件系统和 SQLite，因此无法获得单一原子事务；实现使用同盘 staging、rename 和补偿操作保持一致性。

首个实现不增加跨进程锁。CLI 与 Desktop 同时修改相同安装目录时，依赖路径冲突、SQLite 约束和明确错误拒绝竞争操作。

## Alternatives Considered

### 放入 CLI

Desktop 无法在不反向依赖 CLI 的情况下复用安装规则，因此不采用。

### 放入 `@tooldeck/runtime-node`

会让 runtime 直接依赖 SQLite 和 `.tdplugin` 产品包实现，破坏当前分层，因此不采用。

### 放入 `@tooldeck/host-node`

host-node 的职责是加载和运行插件，不应管理安装资产或用户状态，因此不采用。

### CLI 与 Desktop 各自编排

会复制安全校验、rollback 和 lifecycle 规则，长期容易产生行为漂移，因此不采用。

## References

- [Tooldeck 1.3 Planning](../../planning/1.3.md)
- [CLI Install Workflow](../../planning/1.3/cli-install-workflow.md)
- [Storage Install State](../../planning/1.3/storage-install-state.md)
- [Desktop Drag Drop Install](../../planning/1.3/desktop-drag-drop-install.md)
- [Purge and Future Work](../../planning/1.3/purge-and-future-work.md)
