# Vite Plugin

本文定义 Tooldeck 1.2 中 `@tooldeck/vite-plugin` 的目标、边界和默认构建约定。该包用于让外部 Tooldeck Node 插件项目通过 Vite 生成可被 `@tooldeck/host-node` 加载的稳定 ESM 入口。

## 定位

`@tooldeck/vite-plugin` 是 Tooldeck Node 插件的 Vite 构建集成，不是插件开发期 CLI，也不是 manifest 校验器的完整替代品。

它面向插件项目提供：

```text
src/index.ts
  -> Vite build defaults
  -> dist/index.js
  -> manifest.runtime.entry compatible output
```

1.2 的职责边界是：

```text
@tooldeck/vite-plugin
  Vite 构建规则
  manifest/runtime.entry 相关的构建期约束
  Node ESM 插件入口产物形态控制

@tooldeck/plugin-tools
  generate/check/build 编排
  manifest、locale、generated types、package.json 和 built artifact 的完整项目验证
```

因此 Vite 插件可以做构建期轻量约束，但完整验证仍由 `tooldeck-plugin check` 和 `tooldeck-plugin check --built` 负责。

## 包与入口

包名：

```text
@tooldeck/vite-plugin
```

推荐导出：

```ts
export { tooldeckPlugin };
export type { TooldeckVitePluginOptions };
```

外部插件项目的 `vite.config.ts`：

```ts
import { defineConfig } from "vite";
import { tooldeckPlugin } from "@tooldeck/vite-plugin";

export default defineConfig({
  plugins: [tooldeckPlugin()],
});
```

`@tooldeck/create-plugin` 生成的模板应默认使用上述配置。

## 默认构建约定

1.2 只支持 commands-only Node 插件构建。默认约定：

| 项目           | 默认值          |
| -------------- | --------------- |
| manifest       | `manifest.json` |
| runtime kind   | `node`          |
| source entry   | `src/index.ts`  |
| output dir     | `dist`          |
| output file    | `index.js`      |
| output format  | ESM             |
| target         | `node22`        |
| sourcemap      | `true`          |
| minify         | `false`         |
| code splitting | `false`         |
| cache dir      | `.vite/cache`   |

生成产物默认路径：

```text
dist/index.js
```

对应 manifest：

```json
{
  "runtime": {
    "kind": "node",
    "entry": "./dist/index.js"
  }
}
```

## Vite 配置职责

`tooldeckPlugin()` 应提供与当前内置插件一致的构建默认值：

```ts
export default {
  cacheDir: ".vite/cache",
  build: {
    emptyOutDir: true,
    minify: false,
    outDir: "dist",
    sourcemap: true,
    ssr: "src/index.ts",
    target: "node22",
    rollupOptions: {
      external: nodeBuiltins,
      output: {
        codeSplitting: false,
        entryFileNames: "index.js",
        format: "es",
      },
    },
  },
  ssr: {
    noExternal: true,
  },
};
```

实现时不需要暴露这份对象本身，但行为应与该约定等价。

### External Policy

Vite 插件应默认 externalize：

- Node builtin modules，例如 `fs`、`path`、`module`。
- `node:*` imports，例如 `node:fs`、`node:path`。

插件项目的普通 npm 依赖默认应被打入产物，降低外部插件项目被扫描运行时的依赖解析复杂度。

如果后续发现某些依赖必须 externalize，可以再增加显式配置项。1.2 不默认支持复杂 dependency external policy。

## Manifest 关系

Vite 插件可以读取 `manifest.json`，但只做与构建强相关的约束：

- manifest 文件存在。
- `manifest.runtime.kind` 是 `node`。
- `manifest.runtime.entry` 与最终输出文件一致。

如果 `manifest.runtime.entry` 与配置输出不一致，Vite 插件应失败并给出可行动错误信息，例如提示用户修改 manifest 或调整 `tooldeckPlugin()` options。

Vite 插件不应自动重写 manifest。Manifest 是插件能力的静态声明，自动修改会让构建流程产生隐式状态，也会模糊 `@tooldeck/plugin-tools check` 的职责。

## Options

初版 options 保持少量、明确：

```ts
export interface TooldeckVitePluginOptions {
  manifest?: string;
  entry?: string;
  outDir?: string;
  outputFile?: string;
  target?: string;
  sourcemap?: boolean;
  minify?: boolean;
}
```

默认值：

```ts
tooldeckPlugin({
  manifest: "manifest.json",
  entry: "src/index.ts",
  outDir: "dist",
  outputFile: "index.js",
  target: "node22",
  sourcemap: true,
  minify: false,
});
```

不建议在 1.2 中增加过多配置项。Vite 插件的目标是提供官方推荐路径，而不是覆盖所有 Rollup/Vite 高级场景。插件作者仍然可以在 `defineConfig()` 中追加 Vite 配置。

## 与 Plugin Tools 的关系

`@tooldeck/plugin-tools` 的构建命令负责流程编排：

```text
tooldeck-plugin build --bundler vite
  -> generate
  -> check
  -> vite build
  -> check --built
```

`@tooldeck/vite-plugin` 只参与 `vite build` 这一步。

`tooldeck-plugin build --bundler vite` 可以检测项目是否安装并使用 `@tooldeck/vite-plugin`，但不应把 Vite 配置实现复制到 `@tooldeck/plugin-tools` 内部。构建规则的单一来源应是 `@tooldeck/vite-plugin`。

## 不负责的验证

以下验证不属于 `@tooldeck/vite-plugin`，应由 `@tooldeck/plugin-tools check` 负责：

- manifest schema 完整校验。
- command id 唯一性。
- command id 到隐式 `onCommand:<id>` 激活语义的项目级说明和校验。
- command `inputSchema` 是否属于当前支持的 JSON Schema 子集。
- `x-i18n` 和 `x-ui` 支持字段校验。
- locale 文件存在性和 key 完整性。
- `src/generated/commands.ts` 是否与 manifest 同步。
- `package.json` dependencies、devDependencies 和 scripts 检查。
- 构建产物 default export 是否像 Tooldeck plugin。
- 构建产物是否能被 `@tooldeck/host-node` dynamic import。

这些能力需要更完整的项目上下文，放在 `@tooldeck/plugin-tools` 中可以避免 Vite 插件成为第二套项目检查器。

## 非目标

1.2 中 `@tooldeck/vite-plugin` 不做：

- 创建插件项目。
- 生成 command input types。
- 运行 `tooldeck-plugin check`。
- 扫描 Tooldeck 插件目录。
- 安装、注册、启用或禁用插件。
- 启动 Tooldeck Desktop。
- 执行插件 runtime code。
- 执行 command 来推导 manifest。
- 插件热更新。
- View / table / document 插件专用构建。
- 插件发布、打包或安装包格式。
- 远程插件 registry 集成。

## 实现建议

包结构建议：

```text
packages/
  vite-plugin/
    package.json
    tsconfig.json
    tsconfig.build.json
    vite.config.ts
    src/
      index.ts
      tooldeck-plugin.ts
```

`package.json` 建议：

```json
{
  "name": "@tooldeck/vite-plugin",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "vite": "^8.0.0"
  }
}
```

`vite` 应作为 peer dependency，避免外部插件项目被迫安装与自身构建工具不一致的 Vite 副本。仓库内开发可以把 `vite` 放在 dev dependency 或 workspace root dev dependency。

## 迁移内置插件

当前内置插件的 `vite.config.ts` 已经有重复配置。`@tooldeck/vite-plugin` 实现后，可以把内置插件改为：

```ts
import { defineConfig } from "vite";
import { tooldeckPlugin } from "@tooldeck/vite-plugin";

export default defineConfig({
  plugins: [tooldeckPlugin()],
});
```

这一步可以作为实现包后的验收之一。迁移不应改变内置插件的 manifest、command 行为或构建产物入口。

## 验收标准

- 外部插件项目可以在 `vite.config.ts` 中使用 `tooldeckPlugin()`。
- 默认配置可以把 `src/index.ts` 构建为 `dist/index.js`。
- 构建产物是 Node ESM 文件。
- 构建产物可以被 `@tooldeck/host-node` dynamic import。
- `manifest.runtime.entry` 为 `./dist/index.js` 时，默认构建可以通过。
- `manifest.runtime.kind` 不是 `node` 时，构建失败并输出清晰错误。
- `manifest.runtime.entry` 与输出文件不一致时，构建失败并输出清晰错误。
- Node builtin 和 `node:*` import 不被打入产物。
- 普通 npm dependency 默认被打入产物。
- `@tooldeck/create-plugin` 生成项目默认使用 `@tooldeck/vite-plugin`。
- `tooldeck-plugin build --bundler vite` 可以通过该 Vite 插件完成标准构建流程。
