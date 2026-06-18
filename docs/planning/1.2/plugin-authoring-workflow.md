# Plugin Authoring Workflow

本文定义 Tooldeck 1.2 中外部插件开发的端到端工作流。为支撑该工作流所需的 workspace build / typecheck / test 确定性规则，单独见 [Turborepo Task Graph](./turborepo-task-graph.md)。

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

## Workspace Task Graph

外部插件作者工作流依赖稳定的 workspace 构建产物，尤其是发布 npm 包、内置插件构建和 CLI / Desktop smoke 验证。1.2 中 Turborepo 任务图和 built-in plugin staging 的具体规划不放在本文内展开，见 [Turborepo Task Graph](./turborepo-task-graph.md)。

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

- 具体验收标准见 [Turborepo Task Graph](./turborepo-task-graph.md)。

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
