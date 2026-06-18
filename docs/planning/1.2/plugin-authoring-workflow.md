# Plugin Authoring Workflow

本文定义 Tooldeck 1.2 中外部插件开发的端到端工作流，以及为支撑该工作流所需的 workspace build / typecheck 确定性规则。

1.2 的目标不是引入插件市场、安装包或远程注册流程，而是让 commands-only Node 插件可以在 Tooldeck monorepo 外部开发，并通过发布后的 npm 包完成声明、校验、构建和运行验证。

## 定位

本工作流把 1.2 的三个工具包设计串起来：

```text
@tooldeck/create-plugin
  -> creates an external plugin project

@tooldeck/plugin-tools
  -> generate / check / build / inspect / testing helpers

@tooldeck/vite-plugin
  -> Vite build defaults for Node plugin runtime entry
```

外部插件项目仍然遵守 TPP v1 的核心边界：

- Manifest 是静态能力声明，扫描 manifest 不执行插件代码。
- 插件运行时代码通过 `@tooldeck/sdk-node` 和 `PluginContext` 暴露能力。
- 插件只在匹配 activation event 时懒激活。
- Command 结果返回结构化 `ContentBlock`，不返回 UI component。
- 1.2 只支持可信本地 Node 插件，不支持不可信沙箱或远程插件安装。

## External Plugin Workflow

推荐的插件作者路径：

```text
create external project
  -> install npm dependencies
  -> edit manifest.json and src/index.ts
  -> generate command input types
  -> check manifest and project structure
  -> build Node ESM runtime entry
  -> check built artifact
  -> run through Tooldeck CLI / Desktop with explicit external plugin directories
```

命令示例：

```bash
pnpm dlx @tooldeck/create-plugin my-tooldeck-plugin
cd my-tooldeck-plugin
pnpm install
pnpm check
pnpm build
```

然后从 Tooldeck workspace 验证：

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-tooldeck-plugin
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-tooldeck-plugin
```

具体 command id 以创建器模板生成的 manifest 为准。

## External Project Contract

生成的外部插件项目应是一个独立 npm package，而不是 Tooldeck workspace package。它可以通过 npm 安装并消费 Tooldeck 发布包。

推荐结构：

```text
my-tooldeck-plugin/
  package.json
  manifest.json
  tsconfig.json
  vite.config.ts
  src/
    index.ts
    generated/
      commands.ts
  locales/
    en.json
  README.md
```

`package.json` 推荐脚本：

```json
{
  "scripts": {
    "generate": "tooldeck-plugin generate",
    "check": "tooldeck-plugin check",
    "build": "tooldeck-plugin build --bundler vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

依赖关系：

- `dependencies` 包含 `@tooldeck/sdk-node`。
- `devDependencies` 包含 `@tooldeck/plugin-tools`、`@tooldeck/vite-plugin`、`typescript`、`vite`。
- 插件 runtime code 不应从 Tooldeck monorepo 相对路径导入源码。
- `manifest.runtime.entry` 指向构建产物，默认是 `./dist/index.js`。

生成文件契约：

- `src/generated/commands.ts` 从 `manifest.json` 生成。
- 插件代码可以 import generated command id 和 input type。
- 插件作者不应手写一份和 manifest 重复的 command input map。
- `check` 应能发现 generated file 与 manifest 不同步。

## Tooldeck Runtime Verification

外部插件项目完成 `pnpm build` 后，Tooldeck CLI / Desktop 应能通过现有插件扫描流程读取该项目的 manifest。

内置插件和外部插件采用不同来源：

```text
internal plugins
  -> dev mode: workspace plugins
  -> packaged app: bundled resources/plugins

external plugins
  -> CLI/Desktop explicit --plugin-dir arguments
  -> Desktop dev env TOOLDECK_PLUGIN_DIRS
```

`--plugin-dir` 是 1.2 推荐的开发态入口。它表示“额外加入扫描的可信本地插件项目或插件集合”，不替换内置插件目录，也不表示安装、注册、打包或 marketplace 分发。现有 `--plugins` root override 可以继续作为兼容或内部测试入口，但新的插件作者文档应使用 `--plugin-dir`。

对 external plugin dir 的解释规则：

- 如果路径指向插件项目根目录，Tooldeck 读取该目录下的 `manifest.json`。
- 如果路径指向包含多个插件项目的目录，Tooldeck 可以扫描直接子目录中的 `manifest.json`。
- 扫描阶段只读取 manifest、locale 和必要静态文件，不 import `runtime.entry`。

CLI 规则：

- 内置插件按当前 CLI runtime path 自动扫描。
- `--plugin-dir <path>` 可以出现多次，每个路径都会额外加入扫描。
- 外部目录中的 command 与内置插件 command 一起进入 manifest index。
- 如果外部插件和内置插件声明重复 command id，沿用现有 duplicate command id 错误。

Desktop 规则：

- 内置插件按当前 Desktop runtime path 自动扫描。
- 开发态支持 `pnpm --filter @tooldeck/desktop dev -- --plugin-dir <path>`，并允许重复传入多个 `--plugin-dir`。
- 开发态可选支持 `TOOLDECK_PLUGIN_DIRS`，多个路径用平台 path delimiter 分隔。
- 1.2 不要求 packaged Desktop 提供复杂 UI 来管理外部插件目录。

运行规则：

```text
list commands
  -> reads manifest contributions
  -> does not activate plugin

run command
  -> matches command id
  -> derives implicit activation semantics such as onCommand:<id>
  -> dynamic imports manifest.runtime.entry
  -> calls activate(ctx)
  -> executes registered command handler
  -> records command run history
```

验收点：

- CLI 可以列出外部插件 command。
- CLI 可以运行外部插件 command。
- Desktop 可以扫描同一个外部插件目录并运行 command。
- 扫描 manifest 不触发插件入口代码。
- 命令执行仍写入 SQLite command run history。

## Npm Consumption Contract

1.2 要验证外部插件消费发布包，而不是只依赖 workspace link 的成功。

发布后外部插件应能安装：

- `@tooldeck/protocol`
- `@tooldeck/sdk-node`
- `@tooldeck/plugin-tools`
- `@tooldeck/vite-plugin`
- `@tooldeck/create-plugin`

外部插件模板和文档中不应要求插件作者使用 Tooldeck monorepo 内部路径，例如：

```text
../../packages/plugin-tools/dist/...
```

内置示例插件可以继续留在 workspace 中作为 smoke test，但 1.2 的作者体验验收必须包含 monorepo 外部项目。

## Build / Typecheck Determinism

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

## Acceptance Criteria

External plugin workflow:

- 可以通过 `@tooldeck/create-plugin` 创建 monorepo 外部插件项目。
- 外部插件项目可以用 npm 安装 Tooldeck 发布包。
- 外部插件项目可以运行 `pnpm check`。
- 外部插件项目可以运行 `pnpm build`。
- `pnpm build` 完成 `generate -> check -> vite build -> check --built`。
- Tooldeck CLI 可以通过一个或多个 `--plugin-dir` 扫描并运行外部插件 command。
- Desktop 可以通过一个或多个 `--plugin-dir` 或 `TOOLDECK_PLUGIN_DIRS` 扫描同一个外部插件目录并运行 command。
- manifest scan 不激活插件代码。

Build / typecheck determinism:

- `pnpm build` 在默认 Turbo 并发下稳定通过。
- `pnpm typecheck` 在默认 Turbo 并发下稳定通过。
- `pnpm test` 在默认 Turbo 并发下稳定通过。
- 不需要全局 `concurrency = 1` 才能规避竞态。
- package scripts 不再通过嵌套 `pnpm --filter ... build` 表达普通上游依赖。
- generated files 过期时 `check` 能给出可行动错误。
- built-in plugin build 和 app-specific stage 有清晰 owner。

## Non-goals

本工作流不包含：

- 插件市场。
- 插件安装包格式。
- 远程插件下载或注册。
- 插件 registry。
- 不可信插件沙箱。
- 插件签名。
- 插件依赖解析。
- 插件热更新。
- Desktop 内复杂插件管理 UI。
