# Documentation and Tooldeck 1.4 Release

本文定义 Tooldeck 1.4 在架构迁移和 cleanup 完成后的事实固化、release gate、artifact 验证、
正式发布及发布后验证。

## Status

```text
Release policy accepted; concrete inventory is frozen after plans 1–6.
```

## Entry Conditions

- 规划 1 package map 与 app migration 完成。
- Effect 试点与内部 Schema 选型完成并记录结论。
- Ajv/schema pipeline 完成。
- Nuxt CSR、bridge 和 Desktop build 完成。
- Cleanup inventory 每项已处理；temporary 项有所有者和退出条件。
- 不再存在计划中的新旧 package、React/Nuxt 或 validation 并行迁移。
- 主要行为测试通过，无未记录的高优先级缺陷。
- `1.4.0` Milestone Issue 已完成或明确延期。
- 已形成可以冻结的稳定候选 commit。

稳定候选只是内部工作状态，不建立 alpha、beta 或 rc tag/release。

## Documentation Responsibilities

当前事实文档必须根据最终实现更新：

```text
README.md
AGENTS.md
current architecture and package dependency guide
TPP v1 current-implementation notes
CLI/Desktop README
plugin authoring docs
public package README
ADR index
build/test/release docs
```

最终文件清单在进入本阶段后通过仓库搜索、package graph 和实施 Issue 记录冻结。

`docs/planning/1.2/` 和 `docs/planning/1.3/` 保持历史记录身份，不为了匹配 1.4 重写原始方案。
差异通过当前状态摘要、ADR 和正式架构文档说明。

`docs/planning/1.4.md` 作为 1.4 规划、ADR、实施 Issue、兼容性决定、release verification 和
deferred items 的入口。

## ADR Audit

至少审计：

- Public/internal package boundary 与 runtime/application 职责。
- Runtime-kind host registry。
- Runtime/Application error ownership 和 transport。
- Effect 最终范围。
- Zod 或 Effect Schema 最终选择。
- Ajv、外部 JSON Schema 与内部 Schema 边界。
- Command input/output profile 与 compiler cache。
- Nuxt CSR、routing 和 preload bridge。
- pnpm Catalog 与公开 artifact 约束。

只有长期决定需要独立 ADR。Effect 和内部 Schema 的 ADR 必须记录最终实际结论，而不是规划预期。

## Authoritative Release Gate

至少包含：

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
pnpm check:desktop-boundaries
pnpm smoke:cli
```

本地、PR、dry-run 和 release 尽量复用同一入口。Gate 必须可重复、使用 frozen lockfile、
不依赖未声明本机状态、可定位失败，并在成功/失败后清理临时内容。正式发布 workflow 不得绕过
gate。

额外架构检查：

- `packages/*` 不依赖 internal/apps/plugins。
- Runtime 不反向依赖 application。
- Apps 通过 application facade。
- Preload/renderer 不导入 internal。
- Graph 无环，所有 internal package 为 private。
- 公开 exports/`.d.ts` 不含 Effect、内部 Schema 或 internal types。
- 公共 tarball 不含 `workspace:`、`catalog:` 或 private source。
- Manifests、lockfile 和实际 dependency 一致。
- Installer 只含必要外部 runtime dependency。

## Compatibility and Lifecycle

必须使用真实 1.3 artifact 或固定 fixture，而不是用 1.4 工具重新生成兼容证据：

- 1.3 官方支持范围内的 TPP v1 manifest 可扫描。
- 1.3 `.tdplugin` 可安装和运行。
- Scan/install/uninstall/purge 不激活插件。
- Node plugin 只在匹配 command 时 lazy activate。
- Command input/output、ContentBlock 和 history 保持。

外部作者验证：

```text
create
  -> install dependencies
  -> generate/check
  -> build
  -> pack/inspect
  -> CLI install/run
  -> Desktop drag-and-drop install/run
```

使用 packed public tarball 和隔离项目，避免 workspace link 隐藏缺失 dependency 或 export。

生命周期验证：

```text
build -> pack -> install -> list -> run -> history
  -> disable -> failed run -> enable -> successful run
  -> uninstall -> purge
```

同时验证 source kinds、failed-run history、disabled non-activation、uninstall disappearance、
purge retained-data 和 `cleanupPending`。

## Desktop Acceptance

- Dev mode 正常启动/退出，readiness helper 支持 timeout/cancel/child cleanup。
- Production static renderer 通过 Electron 加载。
- File/hash routing 在 packaged app 中支持 navigation 和 refresh。
- Plugins、commands、history、preferences 和 lifecycle 操作正常。
- Drag-and-drop install、loading/empty/error states 正常。
- Renderer 不接触 raw IPC、SQLite 或 plugin runtime。
- `window.tooldeck` 是单一、按领域拆分的 bridge。
- Installer 脱离仓库和 workspace `node_modules` 后可运行。
- Bundled plugin 可扫描并运行 `json.format`。

三平台至少构建：

```text
Windows: NSIS / MSI
Linux: AppImage
macOS: DMG
```

构建成功不自动等于安装/运行成功；每个平台的实际 smoke 深度必须记录。

## Version Matrix and Artifacts

发布前冻结：

```text
Git tag
GitHub Release
CLI version
Desktop version
public npm package versions
private package version policy
root workspace version semantics
```

至少保持：

```text
CLI/Desktop = 1.4.0
Git tag = v1.4.0
GitHub Release = v1.4.0
```

公开 package 版本根据实际变化和 changeset 决定，不要求所有 workspace 使用同一版本。

Npm 发布前检查 tarball files、exports、dependencies/peerDependencies、`.d.ts`、
publish dry-run、private leakage 和 `workspace:`/`catalog:` 残留。

Desktop 产物从冻结 commit 构建，检查 built-in plugins、installer version/name、app resources、
production dependencies 和三平台 artifact/logs。所有 job 必须检出目标 tag 指向的同一 commit。

## Release Order and Failure Policy

```text
finish implementation/docs
  -> changesets/changelog/release notes
  -> merge release PR
  -> freeze release commit
  -> clean-checkout release gate
  -> create and push v1.4.0 tag
  -> publish npm packages
  -> build Desktop artifacts
  -> publish GitHub Release
  -> post-release verification
```

- Tag 前存在 blocker 时停止发布。
- Tag 不得移动、覆盖或改指向。
- 临时网络问题且 commit 未变化时，可对同一 tag 重试。
- Npm 已发布后发现需要改源码时，停止剩余发布并评估 patch，不覆盖版本或移动 tag。
- Desktop build 失败但 commit 不变时，可从同一 tag 重建。
- 所有重试都必须证明输入 commit 未变化。

## Post-release Verification

- Tag、GitHub Release 和 Desktop artifact 版本一致。
- Npm registry 中目标版本可见，没有误发 private package。
- 发布后的 CLI 可在隔离环境安装并运行。
- 发布后的作者 package 可创建/构建外部插件。
- GitHub Release 含预期平台产物。
- Desktop 可启动并运行 bundled `json.format`。
- Release notes/changelog links 有效。

问题按 `release blocker`、`patch release`、`documentation correction` 或 `deferred follow-up`
建立 Issue。

## Implementation Stages

1. 规划 1–6 持续记录文档、验证、ADR 和 artifact candidates。
2. 稳定后冻结文档 inventory、release checklist、version matrix 和 publish package list。
3. 更新 current docs、README、Agent instructions 和最终 ADR。
4. 统一 release gate，补齐 tarball/`.d.ts`、1.3 fixture 和 isolated smoke。
5. Clean checkout 执行 release gate、external lifecycle、packaged Desktop、publish dry-run 和
   three-platform build。
6. 发布 `v1.4.0`，执行 post-release smoke，记录结果和 follow-ups。

## Implementation Issue

[Issue #42: Finalize Tooldeck 1.4 documentation and release verification](https://github.com/origin-coding/tooldeck/issues/42)
是 planning 7 umbrella Issue：

- 受 cleanup Issue #41 和既有 built-in plugin artifact verification Issue #27 阻塞。
- 前置完成前只维护 candidate。
- 稳定后冻结文档和 release checklist。
- 文档、automation 和实际发布可拆子 Issue。
- 只有子 Issue、gate、artifact verification、正式发布和 post-release smoke 全部完成后关闭。

## Acceptance Criteria

- 当前文档与最终 package map、renderer、error/validation boundary 一致。
- 历史规划保持历史身份，长期决定进入正式文档/ADR。
- 1.4 入口链接实际 ADR、implementation Issues 和 verification result。
- Repository gate 全部通过并在 local/CI/release 使用等价集合。
- 真实 1.3 compatibility fixture、external author flow 和完整 plugin lifecycle 通过。
- Public tarball/`.d.ts` 不泄漏 private types，Desktop installer dependency 正确。
- 三平台 artifact 构建成功且 smoke 深度有记录。
- 所有正式 artifact 来自同一不可变 release commit。
- `v1.4.0`、npm、Desktop/GitHub Release 和 post-release smoke 完成。
- Deferred item 转为明确 Issue，没有未记录高优先级缺陷。

## Non-goals

- 新功能、重新设计规划 1–5 或发布阶段的大迁移。
- Alpha/beta/rc 流程。
- 重写全部历史规划。
- 跳过失败 gate。
- 移动 tag、覆盖 npm version。
- Marketplace、remote install、signing、sandbox 或其他 1.4 外能力。
