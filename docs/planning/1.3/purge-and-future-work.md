# Purge and Future Work

本文记录 Tooldeck 1.3 中 P1/P2 的清理能力和后续版本方向，避免 P0 install/uninstall 闭环被额外能力拖大。

## `tooldeck plugin purge`

`purge` 是显式破坏性清理命令，不进入 1.3 P0。

P1/P2 保留独立命令：

```bash
tooldeck plugin purge dev.example.my-plugin
```

不提供 `tooldeck plugin uninstall --purge` 作为主入口。`uninstall` 和 `purge` 保持不同生命周期语义：

- `uninstall` 移除 installed plugin 资产和安装记录。
- `purge` 清理卸载后仍保留的 plugin id 级本地状态。

## Purge 语义

P1/P2 初始语义：

- `purge` 要求目标 plugin id 当前未安装。
- 如果插件仍然 installed，`purge` 失败，并提示先运行 `tooldeck plugin uninstall <plugin-id>`。
- `purge` 删除 plugin scoped KV。
- `purge` 删除 `plugin_states`。
- command history 默认保留，除非后续明确需要删除历史。
- future permission grants 和 secure storage secrets 的 purge 语义留到对应能力实现时确定。

P0 / P1 边界：

- P0 `uninstall` 保留 KV 和 command history。
- P0 不实现 `purge`。
- P1/P2 通过独立 `tooldeck plugin purge` 命令补齐状态清理。
- `uninstall --purge` 可作为未来 convenience alias 重新评估，但不作为当前设计承诺。

## Replace / Update

1.3 P0 不做 update / replace。

原因：

- 当前设计不支持多版本并存。
- duplicate plugin id 会拒绝安装。
- update 需要更完整 rollback 和权限变更策略。

后续 update 可以沿用：

```text
installed-plugins/<sanitized-plugin-id>/
```

并通过 staging / backup 目录实现回滚：

```text
installed-plugins/.staging/<install-id>/
installed-plugins/.backup/<install-id>/
```

不需要把 version 放入 active install path。

## 多版本安装

多版本并存不进入 1.3。

原因：

- plugin id 是插件身份。
- command id 需要全局唯一。
- 多版本同 id 会和 duplicate plugin id 规则冲突。
- 多版本不同 command id 也会放大 UI、storage、activation 和 history 复杂度。

1.3 明确：

```text
one plugin id -> at most one active installed plugin
```

## Desktop 系统集成

以下 Desktop 能力推迟到 1.4 或后续：

- OS 文件关联。
- 双击 `.tdplugin` 自动打开 Tooldeck。
- `tooldeck://...` deep link。
- 第二实例参数转发。
- Desktop router。
- 自定义跳转链接。
- 更复杂页面状态恢复。

这些能力属于 Desktop 交互/导航/系统集成，不是 1.3 本地插件分发闭环的必要条件。

## 安全增强

1.3 仍是 trusted local plugins。

后续可考虑：

- signature。
- integrity manifest。
- permission approval。
- install-time permission diff。
- untrusted plugin sandbox。
- WASM runtime。
- process isolation。

这些能力不应混入 1.3 P0。

## Marketplace / Remote

以下能力不进入 1.3：

- plugin marketplace。
- remote plugin install。
- remote registry。
- plugin publishing workflow。
- plugin dependency resolution。

1.3 只解决本地可信 `.tdplugin` 文件安装。

## 文档影响

1.3 实现后需要更新：

- plugin authoring README。
- CLI README。
- Desktop README。
- TPP v1 architecture 中的 install lifecycle 说明。
- package format 文档。

P0 文档应避免承诺 P1/P2 能力。
