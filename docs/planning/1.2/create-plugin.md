# Create Plugin

本文定义 Tooldeck 1.2 中 `@tooldeck/create-plugin` 的目标、边界和技术选型。该包用于创建外部 Tooldeck 插件项目，是 1.2 插件开发体验的入口之一。

## 目标

`@tooldeck/create-plugin` 提供一个最小、可工作的 Tooldeck 插件 starter。生成项目应验证以下链路：

```text0
create project
  -> install npm dependencies
  -> write plugin code with @tooldeck/sdk-node
  -> generate command input types with @tooldeck/plugin-tools
  -> build with @tooldeck/vite-plugin
  -> scan manifest from Tooldeck CLI / Desktop
  -> run example command
```

1.2 只提供 commands-only Node 插件模板，不扩展 TPP 协议能力。

## 包与命令

包名：

```text
@tooldeck/create-plugin
```

命令名：

```text
create-tooldeck-plugin
```

推荐使用方式：

```bash
pnpm dlx @tooldeck/create-plugin my-plugin
```

后续可以评估是否额外发布非 scoped 创建器包，以支持：

```bash
pnpm create tooldeck-plugin my-plugin
```

这不是 1.2 的必要目标。

## 初版模板

1.2 只提供一个内置本地模板：

```text
plugin-node-vite
```

模板定位：

```text
commands-only + Node runtime + TypeScript + Vite
```

生成结构建议：

```text
my-plugin/
  package.json
  manifest.json
  tsconfig.json
  vite.config.ts
  src/
    index.ts
  locales/
    en.json
  README.md
```

生成项目默认包含一个示例 command。该 command 用于验证插件可以被 Tooldeck 扫描、懒激活和执行，不代表 1.2 要新增更复杂的插件能力。

## 技术栈

`@tooldeck/create-plugin` 初版使用：

| 能力 | 选择 |
| --- | --- |
| CLI framework | `citty` |
| Prompts | `@clack/prompts` |
| Logs | `consola` |
| Local template IO | `node:fs/promises` |
| Template rendering | `eta` |
| Dependency install | `nypm` |

1.2 暂不支持远程模板，因此不引入 giget 作为必要依赖。未来如果需要支持远程 template registry、GitHub 子目录模板或缓存下载，可以单独评估 giget。

## 模板渲染

模板文件使用 Eta 渲染变量。初版只允许简单变量替换和少量条件分支，不在模板中放复杂业务逻辑。

建议变量：

```text
projectName
packageName
pluginId
pluginName
pluginDescription
commandId
commandTitle
commandDescription
tooldeckVersion
```

渲染约束：

- 只渲染文本文件。
- 二进制文件直接复制。
- 模板业务规则放在 `@tooldeck/create-plugin` TypeScript 代码中，不放在 Eta 模板里。
- 渲染后的 `manifest.json` 必须能通过 `@tooldeck/protocol` manifest schema 校验。

## 交互流程

当用户运行：

```bash
pnpm dlx @tooldeck/create-plugin my-plugin
```

创建器应执行：

1. 解析目标目录。
2. 检查目标目录不存在，或为空目录。
3. 通过 `@clack/prompts` 补齐必要信息。
4. 用 `node:fs/promises` 读取内置模板。
5. 用 Eta 渲染文本文件。
6. 写入目标目录。
7. 通过 `nypm` 可选安装依赖。
8. 输出下一步命令。

基础 prompt：

- 项目名。
- 插件 ID。
- 插件展示名称。
- 示例 command ID。
- 是否立即安装依赖。

如果命令参数已经提供足够信息，创建器应减少交互问题。

## 生成项目契约

生成的 `package.json` 应包含：

```json
{
  "scripts": {
    "build": "tooldeck-plugin build --bundler vite",
    "check": "tooldeck-plugin check",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tooldeck/sdk-node": "^1.2.0"
  },
  "devDependencies": {
    "@tooldeck/plugin-tools": "^1.2.0",
    "@tooldeck/vite-plugin": "^1.2.0",
    "typescript": "^6.0.0",
    "vite": "^8.0.0"
  }
}
```

版本号以实际发布版本为准，模板中应由创建器统一注入。

生成项目应满足：

- `pnpm check` 可以校验 manifest 与项目结构。
- `pnpm build` 可以生成 `dist/index.js`。
- `manifest.runtime.entry` 指向 `./dist/index.js`。
- `src/index.ts` 使用 `@tooldeck/sdk-node` 的 `definePlugin`。
- command input 类型从 `manifest.json` 生成，不手写重复类型。
- 构建产物可以被 `@tooldeck/host-node` 通过 ESM default export 加载。

## 与其他包的关系

`@tooldeck/create-plugin` 只负责创建项目，不负责插件运行或构建规则本身。

```text
@tooldeck/create-plugin
  writes package.json / manifest.json / vite.config.ts / src/index.ts

generated plugin project
  uses @tooldeck/sdk-node at runtime
  uses @tooldeck/plugin-tools for types/check/build command
  uses @tooldeck/vite-plugin from vite.config.ts
```

`@tooldeck/create-plugin` 不应成为 `@tooldeck/sdk-node` 的依赖，也不应被 `@tooldeck/protocol`、`@tooldeck/core` 或 `@tooldeck/host-node` 依赖。

## 非目标

1.2 不做：

- 远程模板下载。
- 多模板 registry。
- 第三方模板市场。
- 插件安装或注册流程。
- view / table / document 插件模板。
- React 插件 UI 模板。
- 插件发布到 npm 的自动化。
- 插件热更新。
- 复杂模板条件系统。

## 验收标准

- `pnpm dlx @tooldeck/create-plugin my-plugin` 可以生成插件项目。
- 生成项目可以运行 `pnpm install`。
- 生成项目可以运行 `pnpm check`。
- 生成项目可以运行 `pnpm build`。
- 生成项目的 manifest 可以被 Tooldeck CLI 通过 `--plugins` 扫描。
- Tooldeck CLI 可以运行生成项目里的示例 command。
- 文档说明创建项目、构建项目和从 Tooldeck workspace 扫描外部插件的基本流程。

