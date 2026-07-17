# Storage Install State

本文定义 Tooldeck 1.3 中插件安装资产、扫描 catalog 和用户状态的 storage 模型。

## 背景

当前 `plugins` 表更接近扫描后的 registry / catalog。它会随 scan 同步，并删除本次扫描缺失的插件。

1.3 引入 installed plugin directory 后，需要区分：

```text
扫描到的插件
已安装的文件资产
plugin id 级用户状态
```

否则 external dev plugin、builtin plugin 和 installed plugin 会在 storage 语义上混在一起。

## 表职责

1.3 使用三类表：

| 表                | 职责                                            |
| ----------------- | ----------------------------------------------- |
| `plugins`         | 当前扫描到的 plugin catalog / registry。        |
| `plugin_installs` | Tooldeck 管理的 installed plugin 文件资产记录。 |
| `plugin_states`   | plugin id 级用户状态，例如 enabled。            |

## `plugins`

`plugins` 继续作为 scanned catalog 表。

1.3 需要补充 source metadata：

```sql
source_kind text not null,
install_dir text
```

`source_kind` 取值：

```text
builtin
installed
external
```

`install_dir` 只对 installed 插件有值。builtin 和 external 插件不由 Tooldeck 安装管理。

`plugins` 不再作为 enabled 状态的唯一权威来源；enabled 应来自 `plugin_states`。

## `plugin_installs`

`plugin_installs` 记录 Tooldeck 管理的 installed plugin 文件资产。

建议字段：

```sql
plugin_id text primary key,
version text not null,
install_dir text not null,
manifest_path text not null,
package_name text not null,
package_digest text not null,
package_size_bytes integer not null,
installed_at integer not null,
updated_at integer not null
```

语义：

- 只记录 installed 插件。
- builtin 插件不进入该表。
- external 插件不进入该表。
- uninstall 只允许删除该表中存在的 plugin id。

`plugin_installs` 不存 enabled。enabled 是 plugin id 级用户状态，不是安装资产属性。

## `plugin_states`

`plugin_states` 记录 plugin id 级用户状态。

建议字段：

```sql
plugin_id text primary key,
enabled integer not null default 1,
created_at integer not null,
updated_at integer not null
```

该表适用于：

- builtin
- installed
- external

这样 disable external 或 builtin 插件时，也有统一状态来源。

## Migration

1.3 migration 需要处理旧 `plugins.enabled`：

```text
old plugins.enabled
  -> plugin_states.enabled
```

迁移后应保持：

- 已禁用插件仍然禁用。
- command run 对 disabled plugin 继续失败。
- command history 不受影响。
- plugin KV 不受影响。

## Sync 行为

扫描时更新 `plugins` catalog。`plugin_installs` 不由普通 scan 删除；它由 install / uninstall service 管理。

如果某个 installed plugin 的文件目录损坏或丢失，普通 scan 可以让它从 `plugins` catalog 中消失，但 `plugin_installs` 的修复/清理策略可在实现阶段定义。

## Uninstall 行为

P0 uninstall：

- 只允许 installed plugin。
- 删除 installed files。
- 删除 `plugin_installs` record。
- 触发 rescan。
- 保留 `plugin_states`。
- 保留 plugin KV。
- 保留 command history。

P1/P2 purge 删除 plugin scoped KV 和 `plugin_states`，默认保留 command history。

## 非目标

1.3 storage P0 不做：

- installed plugin update。
- installed plugin replace。
- 多版本 installed plugin。
- plugin install rollback history 表。
- permission approval state 的完整模型。
- secure storage cleanup。

## 验收标准

- migration 能把旧 `plugins.enabled` 迁移到 `plugin_states`。
- `plugins` 能记录 source kind。
- `plugin_installs` 能 create / list / delete installed asset record。
- `plugin_states` 能 get / set enabled。
- disable 状态对 builtin / installed / external 都适用。
- command history 在 install / uninstall / migration 后不丢失。
