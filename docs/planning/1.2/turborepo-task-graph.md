# Turborepo Task Graph

本文定义 Tooldeck 1.2 中 workspace build / typecheck / test 的确定性目标。该子任务支撑外部插件开发体验，但不负责创建插件项目、实现 plugin-tools CLI 或改变 TPP 协议。

## 目标

1.2 需要修复 workspace build / typecheck / test 对执行顺序的隐式依赖。目标是即使 Turbo 并发执行，也能稳定通过，而不是依赖全局 `concurrency = 1` 作为长期方案。

确定性问题主要来自三类隐式状态：

- package script 内部再调用 `pnpm --filter ... build`，导致 Turbo task graph 和脚本内调度重复。
- generated files 没有明确的生成任务或缓存输入，导致 typecheck 读取到过期产物。
- built-in plugins 的 build / stage 被 app build、CLI smoke 和 desktop dist 混在一起调用。

## Task Graph Principles

Workspace 任务应遵守以下原则：

- 跨 package 依赖由 Turbo `dependsOn` 和 package dependency graph 表达。
- 单个 package 的 `build` 只构建自身产物，不在脚本里手动构建上游 workspace package。
- `typecheck` 可以依赖上游 `^build`，但不应顺便修改源文件。
- `test` 可以依赖上游 `^build`，但测试自身应避免依赖未声明的构建副作用。
- 生成代码必须有明确入口，可以被 `build`、`typecheck` 和 `check` 复用。
- staging 是 app packaging concern，不是每个 library package 的 build concern。

推荐 Turbo 任务语义：

```text
build
  -> creates package distributable outputs

typecheck
  -> verifies TypeScript without writing source files

test
  -> runs package tests after upstream build outputs exist

generate
  -> refreshes generated source files when a package owns generated files

check
  -> verifies generated files, manifest, package structure, and built artifacts

stage
  -> copies already-built artifacts into an app-specific location
```

## Generated Files

插件 generated command types 是确定性风险点。1.2 应选定一种规则并保持一致。

推荐规则：

- `tooldeck-plugin generate` 是唯一生成 command type 的入口。
- `tooldeck-plugin check` 校验 generated file 与 manifest 是否同步。
- 外部插件的 `build` 编排为 `generate -> check -> vite build -> check --built`。
- Workspace 内置插件迁移后也应使用同一套生成入口。
- `typecheck` 默认不修改 generated files；如果 generated file 缺失或过期，应失败并提示运行 `generate` 或 `build`。

这样可以避免 `typecheck` 在并发执行时修改其他任务正在读取的文件。

## Built-in Plugin Build and Stage

内置插件有两个不同动作：

```text
build
  -> plugins/*/dist

stage
  -> apps/cli/dist/plugins or apps/desktop/.vite/builtin-plugins
```

1.2 应把两者分开：

- `plugins/*` package 的 `build` 只生成自己的 `dist`。
- app build 不应隐式重建插件源码，除非该 app 显式依赖一个 `builtin-plugins:build` 任务。
- app dist / packaging 可以执行 stage，但 stage 应复制已构建产物。
- CLI smoke 使用 build 后的 CLI 和 build 后的插件产物。

如果继续保留 root 脚本：

```text
builtin-plugins:build
builtin-plugins:stage
```

它们应被视为独立任务，避免被多个 app script 在并发 build 中同时写同一个 staging 目录。

## Package Script Rules

1.2 实现时应逐步移除容易造成竞态的脚本模式：

```json
{
  "prebuild": "pnpm --filter @tooldeck/shared --filter @tooldeck/storage build",
  "pretypecheck": "pnpm --filter @tooldeck/shared --filter @tooldeck/storage build",
  "pretest": "pnpm --filter @tooldeck/shared --filter @tooldeck/storage build"
}
```

替代方向：

- 在 `package.json` dependencies / devDependencies 中声明真实 workspace 依赖。
- 在 `turbo.json` 中用 `dependsOn: ["^build"]` 表达上游 build 依赖。
- 对 built-in plugin staging 使用单独任务或脚本，避免和 package build 混在一起。
- 对需要先生成类型的插件包，增加显式 `generate` 或让 `build` 内部只生成本包文件。

禁止模式：

- package build 脚本手动构建无关 package。
- 多个并发任务写同一个 output directory。
- `typecheck` 修改 tracked generated files。
- app renderer 代码直接依赖 SQLite 或插件 runtime code 来绕过 task graph。

## Turbo Outputs and Cache

任务 outputs 应只包含该任务拥有的产物：

- library package build: `dist/**`
- Electron desktop build: `.vite/build/**`、`.vite/renderer/**`
- built-in plugin stage for CLI: `apps/cli/dist/plugins/**`
- built-in plugin stage for Desktop: `apps/desktop/.vite/builtin-plugins/**`
- typecheck / test: no persistent outputs

如果某个任务写入 staging directory，该 directory 必须只有一个任务 owner。多个任务需要相同 staged content 时，应拆分为不同 staging output，或让消费者读取同一份已构建源产物。

## 非目标

本子任务不包含：

- 插件作者 CLI 功能设计。
- Vite 插件构建规则设计。
- Desktop 外部插件目录参数设计。
- 发布 npm 包的 CI/CD 流程重做。
- 插件安装包、registry、marketplace 或热更新。

## 验收标准

- `pnpm build` 在默认 Turbo 并发下稳定通过。
- `pnpm typecheck` 在默认 Turbo 并发下稳定通过。
- `pnpm test` 在默认 Turbo 并发下稳定通过。
- 不需要全局 `concurrency = 1` 才能规避竞态。
- package scripts 不再通过嵌套 `pnpm --filter ... build` 表达普通上游依赖。
- generated files 过期时 `check` 能给出可行动错误。
- built-in plugin build 和 app-specific stage 有清晰 owner。
