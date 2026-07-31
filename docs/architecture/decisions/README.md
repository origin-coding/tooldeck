# Architecture Decision Records

本目录记录 Tooldeck 的长期架构决策。ADR 用来解释“为什么这么设计”，不替代版本规划、实现 README 或 API 文档。

ADR 默认使用中文正文，文件名、标题中的稳定识别部分和关键技术术语可以保留英文。例如 `ZipAdapter`、`digest`、`runtime entry`、`ZIP64` 等术语不强制翻译，避免引入额外歧义。

不建议在同一个 ADR 中维护完整中英双语正文。需要面向英文读者时，可以在文档开头补充简短英文摘要；只有确实需要完整双语维护时，才新增独立的 `.en.md` 文件。

## 命名

每个 ADR 使用单独的 Markdown 文件：

```text
NNNN-short-kebab-case-title.md
```

示例：

```text
0001-tdplugin-zip-container.md
0002-node-plugin-management-service.md
```

规则：

- `NNNN` 是递增编号，表示决策记录顺序，不表示版本号。
- 文件名使用英文 kebab-case，保持跨平台路径和链接稳定。
- ADR 合入后尽量不要重命名；如果决策被替代，新增 ADR 并在旧 ADR 中标记关系。

## 状态

ADR 状态使用以下值：

```text
Proposed
Accepted
Superseded
Deprecated
```

## Records

- [ADR 0001: `.tdplugin` Zip Container](./0001-tdplugin-zip-container.md)
- [ADR 0002: Node Plugin Management Service](./0002-node-plugin-management-service.md)
- [ADR 0003: CommandResult Status and Error Invariant](./0003-command-result-status-error-invariant.md)
- [ADR 0004: Defer Ant Design Listy Migration](./0004-defer-antd-listy-migration.md)
- [ADR 0005: Public Packages and Internal Implementation](./0005-public-packages-and-internal-implementation.md)
- [ADR 0006: Runtime-kind Host Registry](./0006-runtime-kind-host-registry.md)
- [ADR 0007: ApplicationError-only Application Facade](./0007-application-error-only-facade.md)
- [ADR 0008: TPP v1 Command Input Schema Profile](./0008-tpp-v1-command-input-schema-profile.md)
- [ADR 0009: Nuxt CSR Renderer and Preload Bridge](./0009-nuxt-csr-renderer-and-preload-bridge.md)
- [ADR 0010: Effect-sequenced State Machine Extraction](./0010-effect-sequenced-state-machine-extraction.md)
- [ADR 0011: Effect-sequenced Application Repository Ownership](./0011-effect-sequenced-application-repository-ownership.md)

## 模板

```md
# ADR NNNN: Short Decision Title

## Status

Proposed

## Date

YYYY-MM-DD

## Context

描述问题背景、约束条件，以及为什么需要做出这个决策。

## Decision

直接写明决策。包含后续实现必须保持的边界。

## Consequences

描述该决策带来的收益、代价和剩余风险。

## Alternatives Considered

列出认真考虑过的备选方案，以及没有选择它们的原因。

## References

链接相关规划文档、issue、实现文档或上游资料。
```
