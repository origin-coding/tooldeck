# CLI-first TPP MVP

状态：历史阶段文档。本文记录最早的 CLI-first 纵向切片验收标准，仍可用于理解当前实现的来源，但不再作为完整 V1 收口范围。当前 V1 收口清单以 [TPP V1 Scope](./v1-scope.md) 为准。

本文定义 `tooldeck` 早期阶段的短期 MVP。

完整协议方向仍以 `docs/architecture/tpp-v1.md` 为准。本文只描述现阶段可交付的更小范围：CLI、commands-only manifest、Node plugin host、SDK 开发体验、`json-tools` 示例插件和 SQLite storage。

## 目标

交付一条小而完整的纵向切片，证明 Toolbox Plugin Protocol 可以通过 CLI 运行可信本地插件命令。

MVP 流程：

```text
manifest scan
  -> command list
  -> command execution request
  -> plugin activation for that command
  -> command handler execution
  -> ContentBlock output
  -> SQLite command history / plugin registry / plugin KV
```

Desktop、完整生命周期管理、权限系统、非 command contribution points 都延后。

## 产品范围

当前产品入口以 CLI 为主。

必须支持：

- 扫描可信本地插件 manifest，且不执行插件代码。
- 列出 manifest 声明的 commands。
- 运行 `json-tools` 插件提供的 `json.format`。
- 从 CLI flags 接收 command input。
- 以可读形式输出结构化 command result。
- 将 command run 写入 SQLite。

核心验收命令：

```text
tooldeck run json.format --text '{"a":1}'
```

期望结果是成功返回 `ContentBlock`，其中包含格式化后的 JSON。

CLI command list：

```text
tooldeck list
tooldeck list commands
```

两条命令都列出 manifest 声明的 commands，输出至少包含 command id、plugin id、title。当前 CLI 入口会静态加载 storage；V1 明确使用 Node 内置的 `node:sqlite` 作为 SQLite driver，因此运行 CLI 时可能看到 `SQLite is an experimental feature` 的 `ExperimentalWarning`。这是当前 Node runtime 对实验 API 的提示，不代表命令执行失败，V1 暂不为消除该 warning 引入 `better-sqlite3`。

## 协议范围

MVP manifest 保持严格模式，并且只允许 commands。

允许字段：

- `schemaVersion`
- `id`
- `name`
- `description`
- `version`
- `runtime`
- `defaultLocale`
- `locales`
- `contributes.commands`
- command `inputSchema`
- command `outputSchema`

MVP 中协议预留但 manifest schema 不允许的字段：

- `contributes.documents`
- `contributes.tables`
- `contributes.views`
- `contributes.settings`
- `contributes.menus`
- `contributes.fileHandlers`
- `activationEvents`
- `permissions`

严格 schema 是当前阶段的明确选择。未来如果加入这些字段，需要通过显式协议/schema 变更，并在需要时补 storage migration。

## 激活范围

MVP 不实现完整生命周期状态机。

当前要实现的行为：

- manifest scanning 不激活插件代码。
- 执行 command 时，如果 command 还没有注册，则激活 owning plugin。
- 激活时加载 Node plugin entry，并调用 `activate(ctx)`。
- 插件必须在 `activate(ctx)` 中注册被请求的 command。
- 如果激活后 command 仍未注册，command execution 失败。

延期行为：

- `notLoaded`、`loading`、`active`、`failed`、`disposed` 等持久化 lifecycle states。
- manifest 中显式声明 `activationEvents`。
- plugin enable/disable 工作流。
- deactivation 调度策略。
- failed activation/deactivation 恢复策略。
- plugin hot reload。

MVP 中 command contribution 隐式等价于：

```text
onCommand:<commandId>
```

这个触发条件由 host 推导，不写入 manifest。

## Storage 范围

SQLite 在当前 MVP 范围内，但只存 runtime state。

必须具备：

- plugin registry records。
- command run history。
- plugin scoped KV。
- schema migrations。

command run history 至少要记录：

- command id
- plugin id，如果可用
- source
- status
- input JSON
- output JSON 或 error JSON
- duration
- created timestamp

权限 storage 延后。CLI-first MVP 不增加 `plugin_permissions`，除非同时实现权限决策流程。

## SDK 范围

SDK 开发体验是当前 MVP 的一等目标，因为这个阶段要验证插件作者能否顺畅写出本地插件。

必须具备：

- `definePlugin()`。
- `activate(ctx)` 支持。
- `deactivate(ctx)` 类型支持，即使生命周期管理暂时很轻。
- `ctx.commands.register()` 返回 `Disposable`。
- `ctx.storage.get()`、`ctx.storage.set()`、`ctx.storage.delete()`。
- `ctx.subscriptions` 管理注册资源。
- command result helpers，例如 text block、success result、error result。
- command input 类型支持。

优先改善：

- 从 `manifest.json` 生成 command input types。
- 示例插件使用生成类型。
- 让 `json-tools` 插件代码足够简洁，成为 SDK 开发体验的验收样本。

SDK 不应暴露 Desktop UI API、renderer API、直接 SQLite 访问或无限制 host internals。

## 示例插件范围

`plugins/json-tools` 是 MVP 必需示例。

必须提供 command：

```text
json.format
```

必须支持：

- 解析输入 JSON text。
- 在 manifest schema 支持时，根据 indent input 格式化 JSON。
- 返回结构化 `CommandResult`。
- 优先使用 SDK helper。
- 演示生成出来的 command input types。

可以保留其他示例插件，但它们不扩大 MVP 验收标准。

## 明确不做

以下内容不属于 CLI-first MVP：

- Desktop app implementation。
- Electron renderer/preload IPC。
- documents、tables、views、settings、menus、fileHandlers。
- permission declarations。
- permission enforcement。
- permission grant UI。
- plugin marketplace。
- remote plugin installation。
- untrusted plugin sandbox。
- WASM plugin runtime。
- MCP adapter。
- OpenAPI adapter。
- plugin signing。
- plugin dependency resolution。
- plugin hot reload。
- complex custom views。
- renderer database access。
- renderer plugin execution。

## 架构边界

即使 Desktop 延后，MVP 也必须保留长期架构边界：

- `packages/protocol` 只定义协议类型和 schema。
- `packages/runtime-node` 是当前 Node runtime 的 TypeScript 实现，负责 manifest indexing、command orchestration、command result validation 和插件运行时契约类型。
- `packages/host-node` 负责 Node plugin loading。
- `packages/sdk-node` 负责 plugin authoring APIs，并 re-export 插件作者需要的 runtime-node 契约类型。
- `packages/storage` 负责 SQLite schema、migrations、repositories。
- `apps/cli` 组合 runtime-node、host-node、storage 和本地插件。
- 插件代码只能通过 `PluginContext` 使用 host 暴露的能力。

不要为了 CLI 便利引入会阻碍未来 Desktop 的捷径，例如让 renderer 直接访问 SQLite 或直接执行插件代码。

## MVP 验收标准

满足以下条件时，当前 MVP 才算完成：

- `tooldeck` 可以扫描本地 plugin manifests，且不运行 plugin entry files。
- `tooldeck` 可以列出 contributed commands。
- `tooldeck run json.format --text '{"a":1}'` 可以成功运行。
- `json-tools` 只在执行 `json.format` 时激活。
- `json.format` 返回结构化 `ContentBlock` output。
- command execution 写入 SQLite command history。
- plugin scoped KV 可通过 `PluginContext` 使用。
- manifest schema 拒绝非 command contribution fields。
- `json-tools` 的 SDK authoring 体验是 typed 且 concise 的。
- build、typecheck、CLI smoke verification 通过。

建议验收命令：

```text
pnpm build
pnpm typecheck
pnpm test
pnpm smoke:cli
```

## 近期工作顺序

Priority 0:

- 保持 manifest schema 严格且 commands-only。
- 确保 CLI scan/list/run 可以跑通可信本地插件。
- 确保 `json.format` 是 canonical smoke test。
- 确保 command run history 写入成功和失败记录。
- 确保 plugin scoped KV 已经通过 `PluginContext` 接入。

Priority 1:

- 改善 `definePlugin()` ergonomics。
- 保持生成的 command input types 与 manifest `inputSchema` 对齐。
- 示例插件默认使用 command result helpers。
- 增加 manifest 拒绝延期字段的测试。
- 增加 command activation 和 history recording 的聚焦测试。

Priority 2:

- 文档化 `activationEvents` migration path。
- 文档化 `permissions` migration path。
- 决定 Desktop 何时成为下一个 milestone。

## 延后决策

超过当前 MVP 后，需要先明确这些问题再实现：

- `activationEvents` 是成为 manifest required field，还是继续对 commands 自动推导。
- `permissions` 是先进入 manifest schema，还是和 `plugin_permissions` 一起进入。
- documents/tables/views 是先只做 in-memory index，还是直接进入 SQLite index。
- lifecycle state 是持久化还是只在内存中追踪。
- plugin deactivation 是用户触发、进程退出触发，还是 idle 后自动触发。
