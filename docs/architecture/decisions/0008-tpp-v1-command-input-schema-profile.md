# ADR 0008: TPP v1 Command Input Schema Profile

## Status

Accepted

## Date

2026-07-24

## Context

Tooldeck 使用 JSON Schema 描述 TPP manifest 和 command input/output，并由 Ajv 执行校验。
1.3 的 runtime、plugin-package 和 plugin-tools 分别维护部分 Schema 与 Ajv 配置。

Runtime 实际能够执行的 command input Schema 超过官方 `plugin-tools` 接受和协议文档声明的
范围。例如 `oneOf`、`anyOf`、`$ref` 和 `$id` 可能被底层 Ajv 偶然接受，但作者工具不承诺这些
能力。非法或不可编译的 command Schema 还可能通过 manifest scan，直到首次运行才失败。

Tooldeck 尚未形成第三方插件生态。1.4 需要在外部采用前明确 TPP v1 的实际公开范围，同时不把
runtime implementation accident 永久固化为兼容合同。

## Decision

Tooldeck 1.4 的 TPP v1 command input 兼容基线定义为：

- 能通过 Tooldeck 1.3 官方 `plugin-tools` 检查。
- 位于当时协议文档和作者工具公开声明的支持范围内。
- 不依赖 runtime 偶然透传的完整 Ajv 能力。

Runtime 曾接受的未声明能力不构成兼容性保证。该收敛不新增 manifest `schemaVersion`。

Command input 固定使用 JSON Schema Draft-07 的 Tooldeck profile。支持：

```text
type
properties
required
additionalProperties
items
allOf
enum
const
default
minimum / maximum
exclusiveMinimum / exclusiveMaximum
multipleOf
minLength / maxLength / pattern
minItems / maxItems / uniqueItems
minProperties / maxProperties
title / description / examples
readOnly / writeOnly / deprecated
x-i18n / x-ui / x-enumLabels
```

`type` 必须是单一标准类型，不支持 type array。允许 object schema、array items、
boolean/object `additionalProperties`、object-schema `allOf` 和 direct boolean property
schema。

不支持：

```text
oneOf / anyOf / not
if / then / else
dependencies / dependentSchemas
patternProperties / propertyNames / contains / additionalItems
definitions / $defs
$ref / $id / $anchor / dynamicRef
```

Boolean Schema 必须保持 `true` 接受、`false` 拒绝的标准语义。

`@tooldeck/protocol` 提供 data-only 的 `command-input-v1.schema.json` 和对应 TypeScript data
types，作为支持范围的单一静态来源。Protocol 不依赖 Ajv。

Runtime 和 plugin-tools 消费同一 profile：

- Plugin-tools 在 `check`、build/pack preflight 和 inspect 时提供作者友好诊断。
- Runtime 在 manifest scan/index 阶段验证并编译 command input/output。
- Schema compilation 不加载或激活插件。
- Command execution 只使用 cached validator，不调用 `compile()`。
- Runtime-scoped compiler/cache 随 runtime rescan/dispose 一起替换或释放，不使用 module
  singleton。

Runtime 为 command input 编译 strict 与 CLI 两个 profile。它们共享 normalized schema 和
稳定 `SchemaIssue[]`；strict 不 coercion，CLI 允许 host-level type coercion；两者可以应用
default，但不得修改调用者持有的原始对象。

Ajv errors 只存在于 validation implementation。Manifest/schema compile、input mismatch 和
output mismatch 分别映射到既有稳定 RuntimeError code，已知 Schema failure 不得降级为
`ERR_UNKNOWN`。

Ajv 继续负责 TPP、`.tdplugin` 和其他外部 JSON Schema。Zod 或 Effect Schema 只处理最终选定的
private TypeScript-first 边界，不能替换或复制本 profile。

## Consequences

Runtime、protocol 和作者工具对“TPP v1 支持什么”有单一来源；不支持的 Schema 在 check/scan
阶段失败，不再推迟到首次 command execution。Per-run compilation 被 runtime-lifecycle cache
替代。

少量曾被 runtime 偶然执行的 manifest 会在 1.4 被拒绝。由于它们未通过 1.3 官方工具且未在
公开范围内，此变化不视为破坏受支持契约；release notes 和 plugin authoring docs 仍必须明确
记录。

Scan time 会提前承担 Schema compile 成本，换取运行期确定性和 cache。实施需要记录 scan time、
command count，并通过 fixture 锁定错误顺序和 message 核心语义。

公开 `plugin-package` 与 `plugin-tools` 可以分别保留自己的 Ajv dependency，但其 API/`.d.ts`
不暴露 Ajv 类型。CLI/Desktop final artifact 需要检查实现去重，renderer/preload 不包含 Ajv。

## Alternatives Considered

### 保留 runtime 接受的完整 Ajv 能力

会把未声明实现越界变成永久契约，并继续让 protocol、tooling 和 runtime 不一致。

### 新增 TPP v2 或 manifest schemaVersion

当前只是明确 v1 已公开支持范围，没有成熟外部生态需要协议大版本迁移。

### 用 Zod 或 Effect Schema 重写 TPP Schema

会失去语言无关的 JSON Schema 契约，并把 private TypeScript implementation 泄漏给插件作者。

### 每个 package 继续维护自己的 keyword list

会再次产生范围漂移，因此 protocol static profile 必须是单一来源。

### 运行 command 时才 compile

会让静态 scan 接受不可执行 manifest，并重复付出 compile 成本。

### 使用全局 Ajv singleton/cache

Cache 生命周期超过 runtime；rescan/uninstall 后可能保留旧 Schema，并使测试和 `$id` registry
互相影响。

## References

- [Tooldeck 1.4 Planning](../../planning/1.4.md)
- [JSON Schema and Ajv Convergence](../../planning/1.4/04-json-schema-ajv.md)
- [TPP v1 Architecture](../tpp-v1.md)
- [Issue #28](https://github.com/origin-coding/tooldeck/issues/28)
