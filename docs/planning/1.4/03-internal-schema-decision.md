# Internal Schema Decision Gate

本文建立 Tooldeck 1.4 应用内部 Schema 的二选一决策门。本文不提前选择 Zod 或 Effect
Schema；最终选择由 Effect 试点后的独立实施 Issue 作出。

## Status

```text
Decision process accepted; technology choice pending.
```

Tooldeck 1.4 最终只保留一种内部 Schema 生产实现：

```text
choose Zod
  -> remove Effect Schema experiments and dependencies

choose Effect Schema
  -> remove Zod experiments and dependencies
```

不得以按模块并存、继续观察、互相生成或“暂时都保留”替代决定。

## Ownership Boundary

Ajv 继续负责：

```text
TPP manifest
command input/output
.tdplugin manifest
external JSON data
JSON Schema Draft-07 profile
```

内部 Schema 只面向 private TypeScript-first 边界：

```text
application use-case input
preferences values and update input
internal config
Desktop main IPC request/response boundary
internal DTO decoded from unknown
```

不要求为所有内部 TypeScript type 建立 runtime Schema，也不得为同一外部输入同时维护 Ajv 与
内部 Schema 两份规则。

无论最终选择哪一项：

- Library 类型不得进入六个公开 package 的 API、exports 或 `.d.ts`。
- 插件 SDK、TPP 和作者工具不要求使用该 library。
- CLI/Desktop 通过 application Promise/DTO facade 使用产品能力。
- Renderer/preload 不导入 internal package。
- Raw library error 不进入 CLI JSON、IPC、history 或 renderer。
- 校验失败映射为 `ApplicationError`，默认
  `source: "application"`、`code: "ERR_INVALID_ARGUMENT"`。

## Decision Inputs

规划 2 必须先给出：

```text
Effect retained and expanded
Effect retained only for a narrow resource-management scope
Effect removed
```

规则：

- Effect 未稳定保留时，默认选择 Zod。
- Effect 只在极窄范围保留时，Effect Schema 必须证明不会显著扩大 Effect 维护面，否则选择
  Zod。
- Effect 稳定保留时，仍需完成相同范围的 Zod/Effect Schema 比较，不得自动选择 Effect
  Schema。
- 结果接近时也必须基于错误模型、边界清晰度和维护成本选择一种。

## Evaluation Slices

使用两个小型、等价且可完整删除的切片：

```text
Slice A: application use-case input or preferences update
Slice B: Desktop main IPC request/response boundary
```

两个候选方案使用相同数据形态、fixture、错误输入和 transport 结果。试验：

- 位于 private implementation 或独立实验目录。
- 不进入公开 exports。
- 不改变现有公开行为。
- 不成为生产路径的长期分支。
- 选择后可以完整删除未采用方案。

## Evaluation Criteria

### Boundary decoding

- 从 `unknown` 解码到目标数据是否清晰。
- Object、array、union、literal、optional、default 和 refinement 表达是否直接。
- 是否避免 parse 后再次手工检查。
- 配置和 IPC 常见形态是否需要额外 wrapper。

### Error model

- Issue 是否容易转换为稳定、JSON-safe 的内部格式。
- 是否保留字段路径、预期值和必要上下文。
- 是否容易映射为 ApplicationError。
- Raw Zod error、ParseResult、Effect Cause 或 library object 是否能限制在实现内部。
- 是否造成相邻层重复包装。

### Effect integration

如果 Effect 被保留：

- 是否自然进入 typed error channel。
- 是否频繁发生同步 parse、Effect 和 Promise 往返。
- 是否迫使 facade、Desktop 或公开 package 暴露 Effect。
- 组合收益是否超过扩大 Effect 使用面的成本。

### TypeScript and maintenance

- 类型推导、编辑器提示和编译错误是否清晰。
- 是否需要重复维护 Schema 与 interface/type。
- 团队是否能用少量规则维护。
- 测试与 failure injection 是否直观。

### Build and artifact cost

记录：

```text
bundle size
startup time
typecheck time
build time
dependency graph
implementation count in CLI/Desktop artifacts
```

不得在 main、preload 和 renderer 中重复打包 Schema library。

### Existing boundary compatibility

- Ajv 继续拥有外部 JSON Schema。
- Apps 只识别 ApplicationError。
- Renderer 不接触 raw IPC、SQLite 或 plugin runtime。
- 公开 package 不泄漏 private dependency。
- CommandResult、history 和可观察错误码不改变。

## Decision Stages

### Stage 0: Wait for the Effect conclusion

完成 runtime/application pilot，并明确 Effect 的保留或退出范围。在结论前不开展内部 Schema
全量迁移。

### Stage 1: Freeze an internal-boundary inventory

- 列出 application inputs、preferences、config 和 IPC 的现有校验路径。
- 标识重复校验、无校验和仅依赖 TypeScript assertion 的边界。
- 选择两个等价切片并固化当前 error/transport 行为。

### Stage 2: Run equivalent experiments

- 分别实现两个候选方案。
- 使用相同 fixture 和 failure cases。
- 记录代码、错误转换、测试体验和构建数据。
- 确认均未进入公开 API。

### Stage 3: Select and record

- 选择一种方案并记录理由和被否决方案。
- 明确允许使用的 package、依赖位置、migration inventory 和验收标准。
- 如果决定具有长期架构影响，新增对应 ADR。

### Stage 4: Remove the rejected option

- 删除未选择方案的源码、测试、adapter 和依赖。
- 检查 lockfile 和应用 artifact。
- 确认仓库不存在两套生产实现，再开始正式迁移。

## Implementation Issue

[#34 Evaluate and select the internal Schema solution](https://github.com/origin-coding/tooldeck/issues/34)

该 Issue：

- 受 application Effect pilot #33 阻塞。
- 必须使用本文的两个等价切片和评估标准。
- 必须选择 Zod 或 Effect Schema。
- 必须记录证据、被否决方案和必要 ADR。
- 必须删除未采用方案的试验实现和依赖。
- 可以把选型后的正式迁移拆成后续 Issue。

## Acceptance Criteria

- 候选只包括 Zod 与 Effect Schema。
- Effect 试点结果是明确的决策输入。
- 两个切片、共同 fixture 和比较维度已固定。
- Ajv 与内部 Schema 职责不重叠。
- 公开 package、application facade 和 IPC transport 边界保持。
- 最终只保留一种生产实现。
- 未选择方案从源码、依赖和 artifact 删除。
- 选型 Issue 记录理由、证据、被否决方案、迁移范围和 ADR 需求。

## Risks

- 小型试验可能低估迁移成本，因此切片必须同时覆盖普通 use case 和 IPC。
- 既有 Effect dependency 可能使 Effect Schema 显得“免费”，仍需检查维护面扩张。
- Zod 会增加新的 runtime dependency，但仍需独立评估其边界和维护优势。
- IPC contract 分布可能导致重复校验；实施时必须保持单一 `window.tooldeck` bridge 和 raw IPC
  隔离。
- 所有试验内容必须进入 cleanup inventory，并在决定后删除或正式迁移。

## Non-goals

- 在规划阶段提前选型。
- 用内部 Schema 替换 Ajv。
- 全仓库强制 Schema 化。
- 让 library 类型或 raw error 进入公开 API/IPC。
- 同时保留两套生产实现。
