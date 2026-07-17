# CLI Install Workflow

本文定义 Tooldeck 1.3 中 CLI 本地插件安装、卸载和运行闭环。

## 目标

CLI 是 1.3 P0 的主验收入口。P0 需要跑通：

```text
tooldeck-plugin pack
  -> tooldeck plugin install
  -> installed plugin scan
  -> tooldeck run
  -> SQLite history
```

## 命令

P0 CLI 命令：

```bash
tooldeck plugin install ./my-plugin.tdplugin
tooldeck plugin uninstall dev.example.my-plugin
tooldeck plugin list
tooldeck plugin enable dev.example.my-plugin
tooldeck plugin disable dev.example.my-plugin
tooldeck run my.command
```

`tooldeck plugin purge` 不进入 P0，单独作为 P1/P2 设计。

## 默认扫描来源

CLI 默认扫描：

```text
builtin -> installed
```

传入 `--plugin-dir`：

```text
builtin -> installed -> external
```

`--plugin-dir` 是增量 external source，不覆盖 builtin 或 installed。

## Install 流程

安装流程：

```text
validate extension
  -> validate package size / file count
  -> unpack to temp
  -> validate package metadata
  -> validate file list
  -> validate manifest
  -> validate runtime entry exists
  -> validate no path traversal / absolute path / symlink escape / node_modules
  -> check duplicate plugin id and command id against current scan sources
  -> move to installed-plugins/<sanitized-plugin-id>/
  -> write plugin_installs
  -> rescan
  -> return installed plugin summary
```

安装过程不得：

- import runtime entry。
- activate plugin。
- run command handler。

## 安装目录

1.3 使用：

```text
installed-plugins/<sanitized-plugin-id>/
```

不使用：

```text
installed-plugins/<plugin-id>/<version>/
installed-plugins/<plugin-id>@<version>/
installed-plugins/<digest>/
```

原因：

- 1.3 不支持多版本并存。
- duplicate plugin id 会阻止同 id 多版本同时存在。
- digest 不应进入路径结构。
- update / replace 不是 P0。

`plugin id` 进入路径前必须 sanitize。即使 manifest schema 已经限制 id，install service 仍应确保最终路径留在 installed plugin directory 内。

## 冲突检测

安装前检查 candidate package 与当前所有 scan sources 的冲突：

```text
builtin
installed
external
candidate package
```

冲突类型：

- plugin id conflict
- command id conflict

错误信息需要包含：

- duplicate id
- existing plugin id
- incoming plugin id
- existing source kind
- incoming source kind
- existing manifest path
- incoming manifest path 或 package path

  1.3 不引入覆盖规则。任何来源冲突都拒绝安装。

## Rollback

安装失败不能留下半安装目录。

需要回滚的情况包括：

- package validation failed
- manifest validation failed
- duplicate check failed
- move failed
- storage write failed
- post-install rescan failed

如果文件已移动但后续失败，应删除 moved dir 或恢复到安装前状态。P0 不要求实现 update rollback，因为 update/replace 不是 1.3 目标。

## Uninstall 流程

卸载命令：

```bash
tooldeck plugin uninstall dev.example.my-plugin
```

规则：

- 只允许卸载 `sourceKind = installed` 的插件。
- builtin 不能 uninstall。
- external 不能 uninstall。
- 删除 installed plugin files。
- 删除 `plugin_installs` record。
- 触发 rescan。
- 保留 plugin KV。
- 保留 command history。
- 保留 `plugin_states`。

## Enable / Disable

enable / disable 对 plugin id 生效，状态存入 `plugin_states`。

disabled 语义：

- 插件仍然出现在 plugin list。
- 插件贡献的 commands 仍然可见。
- command run 被阻止。
- run failure 写入 command history。

## List 输出

`tooldeck plugin list` 应显示：

- plugin id
- name
- version
- enabled
- source kind
- manifest path

可以后续追加 install dir、package digest 等诊断字段，但 P0 首要目标是让来源可见。

## 非目标

P0 CLI install 不做：

- purge。
- replace / update。
- 多版本并存。
- remote install。
- marketplace。
- signature。
- permission approval UI。
- Desktop drag-drop。

## 验收标准

- `tooldeck plugin install ./x.tdplugin` 安装合法包。
- 安装后 plugin list 显示 source kind 为 installed。
- 安装后 command list 显示 installed command。
- installed command 可以运行。
- command run 写入 SQLite history。
- duplicate plugin id 安装失败并输出清晰错误。
- duplicate command id 安装失败并输出清晰错误。
- disabled installed command 运行失败并写入 error history。
- uninstall 后 installed command 不再出现。
- uninstall builtin / external plugin 失败。
