# Migration Cleanup

本文定义 Tooldeck 1.4 主要架构和 renderer 迁移完成后的集中收敛阶段。

## Status

```text
Cleanup policy accepted; concrete inventory is frozen after plans 1–5 land.
```

## Timing

```text
complete plans 1–5
  -> stabilize package/runtime/validation/renderer boundaries
  -> generate and freeze cleanup inventory
  -> remove or merge migration leftovers
  -> verify converged implementation
  -> hand off to plan 7
```

本阶段不承担新架构设计或产品功能。具体文件和 dependency checklist 不在规划阶段猜测，而是
根据最终仓库状态、实施 Issue 记录和 artifact 审计生成。

## Entry Conditions

- Package map、runtime/application consolidation 已完成。
- Effect 与内部 Schema 已得出明确取舍。
- Ajv compiler/cache/error conversion 已落地。
- Nuxt CSR、Desktop bridge 和 build flow 已切换到目标实现。
- 相关行为测试通过，不再有计划中的大范围并行迁移。
- 规划 1–5 的实施 Issue 已记录 cleanup candidates。

前置实现尚未稳定时只记录 candidate，不删除仍在使用的过渡实现。

## Cleanup Inventory

每个候选项记录：

```text
source plan / implementation issue
path or package
current purpose
why it became redundant
proposed treatment
compatibility risk
verification method
```

冻结后分类：

| 状态        | 含义                                  |
| ----------- | ------------------------------------- |
| `remove`    | 已被完整替代，可以删除                |
| `merge`     | 仍有有效内容，迁入最终所有者          |
| `retain`    | 属于目标架构，长期保留                |
| `temporary` | 当前不能删除，必须有所有者和退出条件  |
| `defer`     | 与 1.4 收敛无直接关系，转为后续 Issue |

每项必须有最终结果。不能用无期限“暂时保留”关闭 inventory。

## Known Candidate Sources

### Packages and workspace

- 合并后残留的 `host-node`、`shared`、`preferences`、`storage`、
  `plugin-management-node`。
- 旧 package name 的 path、build、test、script 和 lockfile references。
- 无消费者的 barrel export、type forwarding 和 compatibility entry。
- 违反最终 `packages/`、`internal/`、`apps/` 边界的依赖。

### Runtime, Effect and errors

- 被目标 lifecycle/use-case 替代的旧 control flow。
- 并行 Promise/Effect pilot implementation。
- 不再需要的 Promise/Effect adapters。
- `TooldeckError`、重复 error class、重复 wrapping/serialization 和跨 bundle `instanceof`。
- Effect 缩小或退出后遗留的 import、Layer、service 和 dependency。

已确认的 application Promise facade 不是迁移残留。

### Schema and Ajv

- 分散的 command/manifest/IPC/config validation。
- 被 RuntimeSchemaCompiler 替代的 local Ajv instance 与 per-run compile。
- 重复 error formatting、pointer conversion 和 validation result mapping。
- 未被选中的 Zod/Effect Schema experiment。
- 无调用者的 schema、cache、helper 和 test fixture。

Ajv 与内部 TypeScript-first Schema 的有效职责不同，不得因“统一”而误删。

### Desktop

- 已被 Nuxt 等价替换的 React page/component。
- 被 file routing/Pinia 替换的 Zustand state。
- React、Ant Design、React i18n、Tailwind 和相关 build config。
- 旧 bridge contract、generic IPC wrapper 和 temporary compatibility API。
- 旧 renderer config/script/style/assets/tests。
- `concurrently`、`cross-env`、`wait-on` 和被 readiness helper 替换的逻辑。

删除前必须证明现有页面、交互、loading/empty/error state 已覆盖。

### Dependencies and artifacts

- 源码、script、build、packaging 均无用途的直接 dependency。
- Catalog 迁移后的重复 version declaration。
- 指向旧目录或入口的 TypeScript/Vite/Electron/test config。
- 被 bundle 内联但仍作为 installer runtime dependency 复制的 package。
- 无消费者的 script、generated file、fixture 和 test helper。

未直接 import 不等于无用途；必须检查 build、CLI、Electron main/preload 和 installer。

## Principles

- 兼容性优先于减少代码数量。
- 不删除支持公开插件契约或真实 1.3 `.tdplugin` 的代码。
- 不以 cleanup 改变 command、manifest 或 package 公开语义。
- 最终架构中同一职责只有一个明确所有者。
- 删除 package 时同步清理 workspace、lockfile、build、tests 和 docs。
- 临时兼容代码必须有原因、所有者和退出条件。
- 优先使用现有搜索、dependency graph、build 和 artifact checks，不为了 cleanup 引入新的长期
  工具。
- 不做与 1.4 无关的大范围 rename/format/reorganization。

## Implementation Stages

1. 在规划 1–5 实施中持续记录 candidates。
2. 搜索旧 package/API/renderer 名称，审计 graph、manifests、lockfile、config、tests 和
   artifacts，冻结 inventory。
3. 删除或合并 Node/private package、runtime/error/schema/Ajv leftovers。
4. 删除 React renderer、旧 bridge/build flow 和无效前端依赖。
5. 审计所有 workspace dependency、公开 tarball/`.d.ts` 和 Desktop installer。
6. 运行范围测试与完整 verification，记录 retain/defer 项并移交规划 7。

## Implementation Issue

[Issue #41: Converge Tooldeck 1.4 migration leftovers](https://github.com/origin-coding/tooldeck/issues/41)
是 planning 6 umbrella implementation Issue：

- 受规划 1–5 的终点 Issue #31、#33、#34、#37 和 #40 阻塞。
- 进入条件前只维护 candidate。
- 迁移稳定后冻结具体 checklist。
- Inventory 较大时按 package/runtime、validation、Desktop、dependency audit 拆子 Issue。
- 全部子 Issue、保留理由和验证完成后才关闭。

## Acceptance Criteria

- Workspace 与规划 1 target map 一致，旧 package 不再被源码/config/tests 引用。
- Package graph 无环，public/internal/app dependency boundary 成立。
- Runtime、application、error 和 validation 各只有一个有效实现路径。
- 被替代 adapter/alias 删除，保留的 temporary item 有退出条件。
- Nuxt 完整替代 React，旧 renderer/config/dependencies 不再参与 build。
- 单一 `window.tooldeck` bridge 与 renderer isolation 保持。
- Package manifests、lockfile 和实际用途一致。
- 公共 tarball/`.d.ts` 不泄漏 internal，产物不含 `catalog:`。
- Installer 只携带实际 runtime dependency。
- 1.3 官方支持范围内的 TPP manifest/`.tdplugin`、`json.format`、history 和 lifecycle 行为保持。
- Cleanup inventory 每项有最终状态。
- 完整 repository verification 通过。

## Non-goals

- 新产品功能或重新设计规划 1–5。
- 破坏公开 API、TPP 或 `.tdplugin`。
- 清理所有历史技术债。
- 无证据的依赖替换或个人偏好的全仓重命名。
- 提前合并规划 7 的正式 release acceptance。
- 为未确定未来功能建立抽象。
