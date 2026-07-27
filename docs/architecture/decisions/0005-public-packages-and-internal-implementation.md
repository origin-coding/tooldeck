# ADR 0005: Public Packages and Internal Implementation

## Status

Accepted

## Date

2026-07-24

## Context

Tooldeck 1.3 把对插件作者发布的 package 和只供 CLI/Desktop 使用的私有 Node 实现都放在
`packages/`。目录无法表达兼容责任，私有实现还被拆成多个同进程、同版本且共享消费者的
workspace：

```text
runtime-node
host-node
plugin-management-node
storage
preferences
shared
```

CLI 与 Desktop 分别组合 runtime、database、history、preferences 和 plugin management，
容易产生生命周期、错误和行为差异。`shared` 转发 protocol JSON 类型并拥有跨层错误类，职责
缺少明确所有者。

与此同时，以下 package 已经形成明确的公开使用者和发布边界：

```text
@tooldeck/protocol
@tooldeck/sdk-node
@tooldeck/plugin-package
@tooldeck/plugin-tools
@tooldeck/vite-plugin
@tooldeck/create-plugin
```

它们不应因为私有实现重组而合并或泄漏 private dependency。

## Decision

使用目录表达兼容边界：

```text
packages/  = public, published, compatibility-bearing packages
internal/  = private Tooldeck implementation
apps/      = executable products and platform adapters
plugins/   = Tooldeck plugin projects
```

六个公开 package 保留名称、职责和发布边界。私有实现迁入 `internal/` 并收敛为：

```text
internal/runtime-node       -> @tooldeck/runtime-node
internal/application-node   -> @tooldeck/application-node
```

所有 `internal/*` package 声明 `"private": true`。

现有私有 package 按以下方式合并：

| 1.3 package                                          | 1.4 owner                           |
| ---------------------------------------------------- | ----------------------------------- |
| `runtime-node` + `host-node`                         | `internal/runtime-node`             |
| `plugin-management-node` + `storage` + `preferences` | `internal/application-node`         |
| `shared` JSON types                                  | 直接从 `@tooldeck/protocol` 导入    |
| `shared` errors                                      | 分别迁入 runtime/application 所有者 |

`runtime-node` 负责 manifest、commands、validation、lazy activation、plugin lifecycle、
runtime-kind routing、host adapters 和 RuntimeError。它不依赖 application、SQLite、Electron
或 UI。

`application-node` 单向依赖 runtime，负责 database、preferences、catalog、history、plugin
storage、install/uninstall、enable/disable、purge、application lifecycle 和
ApplicationError。它提供 host-independent use-case facade，不依赖 Electron、CLI formatter
或 renderer framework。

依赖约束：

- `packages/*` 不得依赖 `internal/*`、`apps/*` 或 `plugins/*`。
- `runtime-node` 不得依赖 `application-node`。
- CLI 和 Desktop main 通过 `application-node` 使用产品能力。
- Desktop renderer/preload 不导入 `internal/*`。
- Plugins 只能依赖公开作者 package。
- Workspace package graph 不得存在环。

删除 `shared`，不建立新的通用 `shared` 或 `errors` package。允许 runtime 与 application
分别维护少量有所有权的错误归一化逻辑。

## Consequences

公开 package 的兼容责任可以由目录、发布配置和 boundary checks 明确验证。CLI/Desktop
共享 application use cases，减少重复 composition、storage 和 plugin lifecycle 规则。

`application-node` 会成为较大的 private package；它通过内部模块和窄 facade 控制复杂度，而
不是继续用 workspace boundary 拆分同一产品应用层。

合并 package 会改变 import path、build graph 和 artifact composition，因此实施必须先固化
1.3 exports、`.d.ts`、tarball、errors、history、cleanup 和 `.tdplugin` fixtures，再按
runtime → application → apps 的顺序迁移。

Folder boundary 弱于 package boundary；仓库必须增加 package/import checks。公开 tarball 和
`.d.ts` 还需验证不包含 internal、Effect 或内部 Schema 类型。

## Alternatives Considered

### 保留所有 package，只增加文档

目录仍无法表达 public/private，CLI/Desktop composition 和跨 bundle error 问题也不会解决。

### 合并全部 package

会破坏已稳定的公开作者和 package-format 边界，并扩大兼容风险，因此不采用。

### 新建通用 application/core/shared package

会继续增加无明确外部消费者的 workspace 边界，并可能重新形成跨层错误和 utility 所有权问题。

### 让 apps 直接组合 runtime 与 storage

会保留 CLI/Desktop 行为漂移，无法形成 ApplicationError-only facade，因此不采用。

## References

- [Tooldeck 1.4 Planning](../../planning/1.4.md)
- [Package Boundaries and Dependency Layers](../../planning/1.4/01-package-boundaries.md)
- [TPP v1 Architecture](../tpp-v1.md)
- [Issue #28](https://github.com/origin-coding/tooldeck/issues/28)
