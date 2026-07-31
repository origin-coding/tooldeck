# ADR 0011: Effect-sequenced Application Repository Ownership

## Status

Accepted

## Date

2026-07-31

## Context

`internal/application-node` 的 Application Context 当前创建 command history、preferences、
plugin catalog 和 plugin KV repositories。`PluginManagementService` 接收同一个 database 后，
又为 install、plugin state、plugin catalog 和 plugin KV 创建自己的 repository wrappers。

当前重复实例共享同一个 Drizzle database，repository 也没有 cache、subscription 或独立
transaction state，因此不会造成数据不一致或明显性能问题。但 composition ownership 不清晰：

```text
Application Context
  -> PluginRepository A
  -> PluginKvRepository A

PluginManagementService
  -> PluginRepository B
  -> PluginKvRepository B
  -> PluginInstallRepository
  -> PluginStateRepository
```

如果 repository 后续增加 cache、instrumentation、transaction scope 或 Effect service state，
重复实例可能产生行为漂移。测试替换、failure injection 和 Layer graph 也需要同时处理两套实例。

Effect application pilot 将重建 database/runtime acquisition、Layer dependency graph、Scope 和
Application lifecycle。若现在先调整 constructor injection，随后很可能在 Effect Layer 中再次
改写相同 composition。

## Decision

Repository 所有权收敛安排在 Application Effect lifecycle/Layer 组合落地之后实施。在此之前：

- 允许现有无状态 repository wrappers 暂时重复。
- 不得给这些重复实例增加 cache、subscription 或实例级 transaction state。
- Repository 不得进入 Application public facade 或 apps。

Effect application composition 落地后，Application composition root 必须集中创建并持有唯一的
repository/service set：

```text
Application composition root
  -> database
  -> ApplicationRepositories
       commandRuns
       preferences
       plugins
       pluginInstalls
       pluginStates
       pluginKv
  -> PluginManagementService(repositories)
  -> runtime plugin-storage port(pluginKv)
  -> application domain facades
```

`PluginManagementService` 不再根据 database 自行创建 repositories，而是通过 constructor
dependency 或 Effect Layer requirements 接收 application-owned instances。

Repository 集合是 application 私有 composition detail：

- 不从 `@tooldeck/application-node` 根 facade 导出。
- 不被 CLI、Desktop main、preload 或 renderer 直接消费。
- Runtime 只接收 `PluginStorage` 等窄 port，不接收 repository 或 database。
- Transaction ownership 保持在 application use case/service，不向 runtime 下放。

迁移时必须先固化 install/uninstall rollback、catalog synchronization、enabled-state gate、
plugin KV、history 和 cleanupPending 行为，再替换 composition，避免把依赖注入调整扩大成产品
行为变化。

## Consequences

短期重复是有边界的技术债，不是当前 correctness defect。延后处理可以避免在 Promise
constructor 和 Effect Layer 两种 composition 之间重复迁移。

Effect composition 完成后，每个 repository/service 只有一个 application-owned instance，
instrumentation、mock、transaction 和 future cache 的所有权更明确。Plugin management 变为
依赖已构造服务的 use-case layer，不再兼任 composition root。

Application composition root 会持有更多内部依赖，需要使用内部 aggregate 或 Layer 管理复杂度；
该 aggregate 不得演变为公开 service locator。领域 facade 仍只依赖自己需要的窄 service。

## Alternatives Considered

### 立即把 repositories 注入 PluginManagementService

当前实现成本不高，但 Effect application pilot 随后会再次改变构造和资源管理方式，产生重复
迁移，因此不采用。

### 让 PluginManagementService 拥有全部 repositories

Command history、preferences、enabled-state gate 和 runtime plugin storage 也需要 repositories。
全部交给 plugin management 会扩大其职责，并迫使其他领域通过 plugin service 访问无关数据。

### 永久允许重复 repository instances

当前无状态实现可工作，但会阻碍 cache、transaction scope、instrumentation 和 Effect Layer 的
单一所有权，因此不采用。

### 向 runtime 暴露 repositories

会让 runtime 反向理解 SQLite/application persistence，违反
`runtime-node -> application-node -> apps` 的依赖边界。

## References

- [Effect Pilot in Internal Node Packages](../../planning/1.4/02-effect-pilot.md)
- [Package Boundaries and Dependency Layers](../../planning/1.4/01-package-boundaries.md)
- [ADR 0005: Public Packages and Internal Implementation](./0005-public-packages-and-internal-implementation.md)
- [Issue #30](https://github.com/origin-coding/tooldeck/issues/30)
- [Issue #33](https://github.com/origin-coding/tooldeck/issues/33)
