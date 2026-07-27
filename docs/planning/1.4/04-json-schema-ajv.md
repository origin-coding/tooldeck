# JSON Schema and Ajv Convergence

本文定义 Tooldeck 1.4 对 TPP JSON Schema、Ajv 编译、validator cache、错误转换和作者工具的
收敛方案。

## Status

```text
Accepted planning; implementation pending.
```

兼容性决定见 [ADR 0008: TPP v1 Command Input Schema Profile](../../architecture/decisions/0008-tpp-v1-command-input-schema-profile.md)。

## Decision Summary

```text
Ajv remains the external JSON Schema validator.
Protocol owns static schemas and data contracts.
runtime-node owns runtime compilation, cache and SchemaIssue conversion.
plugin-tools consumes the same static input profile.
Command schemas compile during scan, never during command execution.
```

Ajv 不由 Zod 或 Effect Schema 替换。

## Compatibility Baseline

Tooldeck 1.4 保证兼容能通过 Tooldeck 1.3 官方 `plugin-tools`、且位于当时公开范围内的 TPP v1
manifest 和 `.tdplugin`。

Runtime 偶然接受但作者工具未支持的 `oneOf`、`anyOf`、`$ref`、`$id` 等 command input
能力不是兼容合同。1.4 在不新增 `schemaVersion` 的情况下，把 runtime 和工具链收敛到单一
公开 profile。

## Package Ownership

### `@tooldeck/protocol`

Protocol 保持 data-only。它可以包含：

```text
TooldeckJsonSchema / TooldeckInputJsonSchema types
manifest-v1.schema.json
command-input-v1.schema.json
dialect/profile identifiers
supported keyword and extension metadata
```

它不得依赖 Ajv，也不包含 compiler、validator cache、Ajv errors 或运行时错误转换。

### `@tooldeck/runtime-node`

Runtime 拥有：

```text
RuntimeSchemaCompiler
runtime-scoped Ajv instances
command validator cache
manifest/runtime schema validation
input normalization
input/output validation
SchemaIssue normalization
cache disposal
```

### `@tooldeck/application-node`

Application 不创建或调用 Ajv，不处理 `ErrorObject` 或 `ValidateFunction`。它只调用 runtime use
case，并把 RuntimeError 映射为 ApplicationError。

### `@tooldeck/plugin-package`

Package format 可以保留自己的 Ajv，因为它是独立公开边界并拥有 ZIP/package-specific
structure。公开 API/`.d.ts` 不得暴露 Ajv 类型。它不提供通用 command compiler。

### `@tooldeck/plugin-tools`

作者工具从 protocol 读取同一份 `command-input-v1.schema.json`。它可增加 manifest path、
field suggestion、runtime entry、locale、`x-ui` cross-field 和 generated type 等作者诊断，但
不得独立维护 supported keyword source，也不得依赖 private runtime。

## Dialect

Tooldeck 1.4 固定：

```text
JSON Schema Draft-07
```

实施时必须统一 Draft-07 canonical URI 或显式注册 HTTPS meta-schema alias，并在
`validateSchema: true` 下编译。不得继续通过 `validateSchema: false` 隐藏 URI 或 schema
合法性问题。

## Command Input Profile

支持的 keyword：

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
minimum
maximum
exclusiveMinimum
exclusiveMaximum
multipleOf
minLength
maxLength
pattern
minItems
maxItems
uniqueItems
minProperties
maxProperties
title
description
examples
readOnly
writeOnly
deprecated
x-i18n
x-ui
x-enumLabels
```

`type` 只允许单一 `object | array | string | number | integer | boolean | null`，不允许 type
array。

允许：

```text
properties
object-schema items
boolean or object-schema additionalProperties
allOf with object-schema entries
boolean schema as a direct property schema
```

明确不允许：

```text
oneOf / anyOf / not
if / then / else
dependencies / dependentSchemas
patternProperties / propertyNames / contains / additionalItems
definitions / $defs
$ref / $id / $anchor / dynamicRef
```

Boolean Schema 保持标准语义：`true` 接受任意值，`false` 拒绝任意值，normalization 不得把
`false` 改成 `{}`。

扩展约束：

- `x-ui` 只位于 input root 或 root direct properties。
- Field control 必须与类型兼容。
- `fieldOrder` 只引用 root properties 且不重复。
- `rows` 是正整数，`placeholder` 是 LocalizedString。
- `x-i18n` 只允许已声明字段。
- `x-enumLabels` 只用于 enum，其 key/value 对应由语义检查验证。

## Input Profiles

每个 command 在 scan 时编译两份 input validator。

Strict input 用于 Desktop/application：

```text
coerceTypes = false
useDefaults = true
strictNumbers = true
```

CLI input：

```text
coerceTypes = true
useDefaults = true
strictNumbers = true
```

两者使用同一 normalized schema，并产生同一格式的 `SchemaIssue[]`。输入先复制为 JSON-safe
value，Ajv 不修改调用者持有的原始对象。CLI coercion 是 host 行为，不是 TPP 标准语义。

## Output Schema

`outputSchema` 校验完整 `CommandResult`。1.4 不扩展其能力：

```text
no remote schema loading
no external-file $ref
no ajv-formats
no defaults
no coercion
no output mutation
no x-ui
```

文档内部引用的既有支持范围由 compatibility fixture 和同步 Draft-07 compiler 验证。无法支持的
引用或 format 应在 scan/plugin-tools 阶段失败。

## RuntimeSchemaCompiler

建立 Tooldeck-specific 窄服务：

```ts
interface RuntimeSchemaCompiler {
  compileCommand(options: {
    pluginId: string;
    commandId: string;
    inputSchema?: TooldeckInputJsonSchema;
    outputSchema?: TooldeckJsonSchema;
  }): CompiledCommandSchemas;
  dispose(): void;
}
```

Validator 返回自有结果，不暴露 Ajv 类型：

```ts
type SchemaValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; issues: SchemaIssue[] };
```

生命周期：

```text
create runtime/compiler
  -> scan and validate manifests
  -> normalize and compile command schemas
  -> attach validators to IndexedCommand
  -> execute using cached validators
  -> dispose compiler with runtime
```

禁止模块级 Ajv singleton。Cache 可以使用
`pluginId + commandId + input-strict|input-cli|output`，只属于当前 runtime/index 生命周期。
Application rescan 重建 runtime 时同步替换 compiler；旧 runtime dispose 释放 validator 和
schema registry。

Manifest scan 与 Schema compilation 都不加载插件代码：

```text
schema compilation != plugin activation
```

Command execution 不得调用 `compile()`，重复运行不得增加 cache size。

## Stable Schema Issues

Runtime 使用 Ajv-independent 结构：

```ts
interface SchemaIssue {
  instancePath: string;
  propertyPath: string;
  keyword: string;
  message: string;
  expected?: JsonValue | JsonValue[];
  actual?: JsonValue;
}
```

统一转换处理 JSON Pointer、required/additional property、array index、expected、actual 和
fallback message。Ajv `ErrorObject` 不离开 validation implementation。

错误映射：

| 场景                                       | RuntimeError code      |
| ------------------------------------------ | ---------------------- |
| Manifest 或 command schema compile failure | `ERR_INVALID_ARGUMENT` |
| Command input mismatch                     | `ERR_INVALID_ARGUMENT` |
| Command output mismatch                    | `ERR_COMMAND_FAILED`   |

Details 记录稳定 issue kind、plugin/command、schema role、manifest path 和 `SchemaIssue[]`。
Compile exception 不得降级为 `ERR_UNKNOWN`。用户 message 可继续使用第一条 issue，但
diagnostic/details 应保留全部 issues。

插件主动返回的 `CommandResult.error` 不进入本错误模型。

## Strict Mode and Extensions

- 显式注册支持的 Tooldeck annotation/extension。
- Input profile 在 Ajv 前拒绝不支持 keyword。
- 已知 extension 不产生 strict warning。
- Keyword 拼写错误不得静默忽略。
- Strict options 通过 compatibility fixture 确定，不用单一 `strict: false` 逃避问题。

## Build Constraints

- `internal/runtime-node` 声明明确 Ajv 8 版本。
- CLI final artifact 只有一份 Ajv 8 implementation。
- Desktop main final artifact 只有一份 Ajv 8 implementation。
- Renderer/preload 不包含 Ajv。
- `plugin-package` 和 `plugin-tools` 可以在各自公开发布边界声明直接 Ajv dependency。
- 同一应用 artifact 中由 bundler 去重。

## Implementation Stages

1. 固化 supported/unsupported、boolean schema、defaults、CLI coercion、strict input、
   compile failure、output mismatch、`$ref`、repeat run 和 rescan fixtures。
2. 增加 protocol static input profile，修正 Draft-07 URI，并让 TypeScript 类型与实际范围一致。
3. 在 runtime 建立 compiler、scan-time compilation、cache lifecycle 和 SchemaIssue。
4. 让 plugin-tools 使用 protocol profile，收敛 type-generator 与 package 校验边界。
5. 清理旧 singleton、per-run compile、重复 transform/error conversion，并审计 artifacts。

## Implementation Issues

1. [#35 Define the supported command input Schema profile](https://github.com/origin-coding/tooldeck/issues/35)
2. [#36 Centralize Ajv compilation and validator caching](https://github.com/origin-coding/tooldeck/issues/36)
3. [#37 Align Schema diagnostics and deduplicate Ajv](https://github.com/origin-coding/tooldeck/issues/37)

#36 受 runtime consolidation #29 和 protocol profile #35 阻塞。#37 受 apps/package migration
#31、protocol profile #35 和 runtime compiler #36 阻塞。

## Acceptance Criteria

- Draft-07 profile 可在 `validateSchema: true` 下编译。
- Input support range 只有一份 protocol static source。
- Runtime/plugin-tools 对共同 fixtures 结果一致。
- 不支持 keyword 在 scan/check 阶段失败，boolean schema 语义正确。
- 每个 command/profile 在单个 runtime 生命周期最多编译一次。
- Repeat run 不 compile、不扩大 cache；rescan/dispose 释放旧引用。
- Schema failure 使用稳定错误码和 JSON-safe `SchemaIssue[]`。
- Ajv object/type 不进入 application、CLI、IPC、history、renderer 或公开 `.d.ts`。
- Protocol/application/renderer 不依赖 Ajv；tooling 不依赖 private runtime。
- CLI/Desktop main 各只有一份 Ajv implementation。
- Scan 仍不执行插件代码，command 仍 lazy activate。

## Non-goals

- 用内部 Schema 替换 Ajv。
- 支持完整 Draft-07 input、远程/外部 `$ref`、network schema 或 `ajv-formats`。
- 自定义 executable keyword。
- Renderer-side Ajv。
- Standalone validator source 或跨 runtime persistent cache。
- 新建通用 JSON Schema implementation package。
