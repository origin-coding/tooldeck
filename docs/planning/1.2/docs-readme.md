# Docs / README

本文定义 Tooldeck 1.2 中 contributor 和 plugin author 基础文档的交付范围。该子任务不新增协议或 runtime 能力，只负责把 1.2 插件开发路径整理成可读、可维护的入口文档。

## 目标

- 新 contributor 可以从仓库 README 理解如何安装依赖、构建、测试和运行 Desktop / CLI。
- Plugin author 可以从文档理解如何创建外部插件项目、生成类型、校验、构建，并用 Tooldeck CLI / Desktop 验证。
- 发布到 npm 的插件开发包有最小 README，说明包职责、常用命令和与其他包的关系。
- 文档使用 1.2 的正式命令和参数，不再要求插件作者引用 Tooldeck monorepo 内部路径。

## 文档交付

1.2 至少补充或更新这些文档：

```text
README.md
docs/plugin-authoring/
packages/plugin-tools/README.md
packages/vite-plugin/README.md
packages/create-plugin/README.md
```

如果实现中选择把外部插件教程放在 `docs/plugin-authoring/README.md` 或更具体的文件中，两者都可以接受；关键是从仓库根 README 能找到入口。

## Contributor README 内容

仓库根 README 应覆盖：

- 项目定位：Tooldeck 是基于 TPP 的 Desktop + CLI 可信本地插件工具箱。
- 技术栈：Electron、React、TypeScript、electron-vite、pnpm workspace、SQLite、Drizzle ORM、node:sqlite。
- 基础命令：install、build、typecheck、test、Desktop dev、CLI dev。
- 规划和架构入口：`docs/architecture/tpp-v1.md`、`docs/architecture/v1-scope.md`、`docs/planning/1.2.md`。
- 约束摘要：Renderer 不直接访问 SQLite，不直接执行插件代码；manifest scan 不激活插件 runtime。

## Plugin Author 文档内容

Plugin author 文档应覆盖：

- 使用 `pnpm dlx @tooldeck/create-plugin my-plugin` 创建外部插件项目。
- 外部项目依赖 `@tooldeck/sdk-node`、`@tooldeck/plugin-tools`、`@tooldeck/vite-plugin`。
- `manifest.json` 是静态能力声明；command input types 从 manifest 生成。
- 常用命令：`pnpm check`、`pnpm build`、`tooldeck-plugin inspect`。
- 用 CLI 验证外部插件：

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-plugin
```

- 用 Desktop dev 验证外部插件：

```bash
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-plugin
```

- 内置插件自动扫描；外部插件只通过显式 external plugin dir 开发入口加入扫描。
- 1.2 不提供插件安装包、插件 marketplace、远程 registry、热更新或不可信沙箱。

## Package README 内容

`@tooldeck/plugin-tools` README 应说明：

- `tooldeck-plugin generate`
- `tooldeck-plugin check`
- `tooldeck-plugin build --bundler vite`
- `tooldeck-plugin inspect`
- `@tooldeck/plugin-tools/testing`
- Programmatic API 的稳定性边界

`@tooldeck/vite-plugin` README 应说明：

- `tooldeckPlugin()` 的默认构建约定。
- `manifest.runtime.entry` 与 `dist/index.js` 的关系。
- Node builtin external policy。
- Vite 插件只负责构建集成，不替代 `tooldeck-plugin check`。

`@tooldeck/create-plugin` README 应说明：

- 创建器用法。
- 生成项目结构。
- 生成后的下一步命令。
- 如何从 Tooldeck workspace 验证外部插件。

## 非目标

1.2 文档不做：

- 插件市场文档。
- 插件安装包或发布 registry 文档。
- 远程插件安装教程。
- 不可信插件权限或沙箱教程。
- View / table / document 插件 authoring 教程。
- 完整 TPP 协议参考手册。

## 验收标准

- 仓库根 README 包含 contributor 基础路径。
- Plugin author 文档可以独立指导用户创建、校验、构建和验证外部插件。
- `@tooldeck/plugin-tools`、`@tooldeck/vite-plugin`、`@tooldeck/create-plugin` 有最小 README。
- 文档示例使用 `--plugin-dir`，不使用 monorepo 内部相对源码路径作为插件作者路径。
- 文档明确 1.2 不包含插件安装、打包、registry、marketplace 或热更新。
