# Plugin Tools

本文定义 Tooldeck 1.2 中 `@tooldeck/plugin-tools` 的目标、边界和功能分级。该包是 1.2 插件开发体验的主线，负责让外部插件项目可以完成类型生成、项目校验、构建编排和本地测试辅助。

## 定位

`@tooldeck/plugin-tools` 是插件开发期工具包，不是插件运行时 SDK，也不是 Tooldeck runtime。

它面向插件作者提供：

```text
manifest.json
  -> generated command types
  -> project checks
  -> build orchestration
  -> local test helpers
  -> project inspection
```

`@tooldeck/plugin-tools` 应以 TPP 静态契约为中心。Manifest 仍然是插件能力的权威声明，扫描 manifest 不应执行插件代码，插件运行代码仍然通过 `@tooldeck/sdk-node` 编写。

## 包与命令

包名：

```text
@tooldeck/plugin-tools
```

主命令：

```text
tooldeck-plugin
```

1.1 已有的 `tooldeck-plugin-types` 可以在 1.2 中保留为兼容入口，但推荐文档和新模板都应使用 `tooldeck-plugin generate`。

推荐外部插件项目脚本：

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

## 生成方向

1.2 明确采用 manifest-first：

```text
manifest.json -> src/generated/commands.ts
```

不采用：

```text
src/index.ts command registration -> manifest.json
```

原因：

- TPP 要求 manifest 是静态声明。
- Manifest scanning 不能 import 或执行插件代码。
- Lazy activation 要求 command 只有在被调用时才激活插件。
- 从 runtime code 反推 manifest 会引入 AST / 执行时推导复杂度，不适合 1.2。

未来可以提供静态 manifest authoring API：

```text
tooldeck.manifest.ts -> manifest.json -> generated command types
```

但该 API 只能用于纯声明，不能依赖插件 runtime activation。此方向属于 P2，不进入 1.2 必做范围。

## P0 功能

P0 是 1.2 必须完成的插件开发闭环。

### Generate

命令：

```bash
tooldeck-plugin generate
tooldeck-plugin generate types
```

默认输入：

```text
manifest.json
```

默认输出：

```text
src/generated/commands.ts
```

生成内容：

- 每个 command 的 input TypeScript interface。
- `PluginCommandInputs` command input map。
- Command id 常量，便于插件代码避免手写字符串。

示例输出：

```ts
export interface JsonFormatInput {
  text: string;
  indent?: number;
}

export interface PluginCommandInputs {
  "json.format": JsonFormatInput;
}

export const commandIds = {
  jsonFormat: "json.format",
} as const;
```

生成器只消费 manifest 静态数据，不读取或执行 `src/index.ts`。

### Check

命令：

```bash
tooldeck-plugin check
tooldeck-plugin check --built
tooldeck-plugin check --manifest manifest.json
```

`check` 是 `@tooldeck/plugin-tools` 的核心能力。它应该给插件作者输出可行动的错误信息，而不只是底层 schema 报错。

基础校验：

- `manifest.json` 符合 `@tooldeck/protocol` manifest schema。
- `manifest.runtime.kind` 是当前支持的 `node`。
- `manifest.runtime.entry` 存在且指向预期构建产物，例如 `./dist/index.js`。
- `contributes.commands[*].id` 在当前 manifest 内唯一。
- `activationEvents` 覆盖 manifest 中声明的 commands，例如 `onCommand:<id>`。
- Command `inputSchema` 属于当前支持的 JSON Schema 子集。
- `x-i18n` 和 `x-ui` 只使用当前支持字段。
- Locale 文件存在，`LocalizedString.key` 能在 locale 文件中解析。
- `src/generated/commands.ts` 与 manifest 同步。
- `package.json` 包含必要依赖和脚本。

`--built` 额外校验：

- `manifest.runtime.entry` 指向的文件存在。
- 构建产物是 Node ESM 可加载文件。
- 构建产物 default export 看起来像 Tooldeck plugin。
- 构建产物不要求立即执行 command，不应绕过 lazy activation。

`check` 不负责扫描全局插件目录，也不负责安装、启用或注册插件。

### Build

命令：

```bash
tooldeck-plugin build --bundler vite
```

`build` 不直接实现 bundler，而是编排插件项目的标准构建流程：

```text
generate
  -> check
  -> vite build
  -> check --built
```

`--bundler vite` 使用 `@tooldeck/vite-plugin` 作为默认构建集成。`@tooldeck/plugin-tools` 负责命令体验和流程编排，`@tooldeck/vite-plugin` 负责 Vite 配置细节。

1.2 不要求支持其他 bundler。命令保留 `--bundler` 参数是为了让错误信息和未来扩展边界清晰。

## P1 功能

P1 也进入 1.2 范围，但可以在 P0 稳定后实现。

### Testing Helpers

测试不做成完整 CLI test runner。插件项目直接使用 Vitest 或 Jest。

`@tooldeck/plugin-tools` 提供测试框架无关的 helper：

```ts
import { createPluginTestHost } from "@tooldeck/plugin-tools/testing";
```

目标能力：

- 创建最小 `PluginContext`。
- 激活插件 default export。
- 调用已注册 command。
- Mock plugin scoped KV。
- Mock logger。
- 追踪并 dispose subscriptions。
- 校验基础 `CommandResult` / `ContentBlock` 结构。

Vitest 示例：

```ts
import { describe, expect, it } from "vitest";
import plugin from "../src/index";
import manifest from "../manifest.json";
import { createPluginTestHost } from "@tooldeck/plugin-tools/testing";

describe("plugin commands", () => {
  it("runs hello.world", async () => {
    const host = await createPluginTestHost(plugin, manifest);
    const result = await host.runCommand("hello.world", { name: "Ada" });

    expect(result.status).toBe("success");

    await host.dispose();
  });
});
```

Dependency policy：

- `@tooldeck/plugin-tools/testing` 不直接 import `vitest`。
- `vitest` 不需要成为 `@tooldeck/plugin-tools` 的 peer dependency。
- 生成项目可以把 `vitest` 放在自己的 `devDependencies`。
- 如果未来提供 `@tooldeck/plugin-tools/vitest` 专用断言入口，再考虑 optional peer dependency。

### Inspect

命令：

```bash
tooldeck-plugin inspect
```

输出插件项目报告，用于本地排查和 issue 复现：

- Plugin id、name、version。
- Manifest path。
- Runtime entry。
- Commands 列表。
- Activation events。
- Locale 文件状态。
- Generated files 状态。
- Build output 状态。
- 检测到的 package manager。
- 已安装 Tooldeck 包版本。

`inspect` 应只读取项目文件，不执行插件 runtime code。

### Watch

命令：

```bash
tooldeck-plugin generate --watch
```

监听：

```text
manifest.json
locales/*.json
```

行为：

- Manifest 变化后重新生成 command types。
- Locale 变化后可以重新执行轻量 check。
- 不做插件热更新。
- 不自动启动或重启 Tooldeck Desktop。

### Programmatic API

`@tooldeck/plugin-tools` 应导出可复用 API，避免 `@tooldeck/create-plugin`、集成测试和内部脚本只能 shell out 到 CLI。

建议导出：

```ts
export {
  generatePluginCommandTypes,
  checkPluginProject,
  buildPluginProject,
  inspectPluginProject,
};
```

CLI 应调用同一套内部 API，避免 CLI 逻辑和库逻辑分叉。

## P2 后续方向

以下方向不进入 1.2 必做范围：

- `tooldeck.manifest.ts` 静态 manifest authoring API。
- 从 manifest 生成 command handler skeleton。
- 插件 package / release / publish helper。
- 插件安装包格式。
- 插件市场或 registry 集成。
- 完整 test runner。
- 插件热更新。
- 从 runtime command registration 反推 manifest。

## 与其他包的关系

```text
@tooldeck/sdk-node
  runtime SDK used by plugin code

@tooldeck/plugin-tools
  authoring CLI, checks, generation, build orchestration, testing helpers

@tooldeck/vite-plugin
  Vite defaults for Tooldeck Node plugins

@tooldeck/create-plugin
  scaffolds a project that consumes sdk-node, plugin-tools, and vite-plugin
```

`@tooldeck/plugin-tools` 可以依赖 `@tooldeck/protocol` 来读取类型和 schema。它不应成为 `@tooldeck/protocol`、`@tooldeck/core`、`@tooldeck/host-node` 或 `@tooldeck/sdk-node` 的依赖。

## 非目标

1.2 中 `@tooldeck/plugin-tools` 不做：

- 运行 Tooldeck Desktop。
- 管理插件安装、启用、禁用。
- 扫描用户全局插件目录。
- 实现完整 Tooldeck runtime。
- 替代 `@tooldeck/sdk-node`。
- 替代 `@tooldeck/vite-plugin` 的 Vite 集成职责。
- 执行插件 command 来生成 manifest。
- 提供完整 CLI test runner。
- 插件热更新。
- 插件发布到市场。

## 验收标准

- 外部插件项目可以运行 `tooldeck-plugin generate` 生成 command input 类型和 command id 常量。
- 外部插件项目可以运行 `tooldeck-plugin check` 校验 manifest、类型生成状态、locale、activation events 和 package 结构。
- 外部插件项目可以运行 `tooldeck-plugin build --bundler vite` 完成 `generate -> check -> vite build -> check --built`。
- 构建产物中的 `manifest.runtime.entry` 可以被 `@tooldeck/host-node` 通过 ESM default export 加载。
- 插件项目可以用 Vitest 配合 `@tooldeck/plugin-tools/testing` 测试 command handler。
- `tooldeck-plugin inspect` 可以输出可用于排查的插件项目报告。
- `tooldeck-plugin generate --watch` 可以在 manifest 变化时刷新 generated types。
- `@tooldeck/create-plugin` 生成的项目默认使用上述 P0/P1 能力。
