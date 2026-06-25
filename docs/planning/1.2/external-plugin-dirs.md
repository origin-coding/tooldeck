# External Plugin Dirs

本文定义 Tooldeck 1.2 中外部本地插件目录的扫描入口、职责边界和验收标准。该子任务把外部插件开发工作流中的 runtime 验证能力单独拆出，因为它同时影响 `packages/runtime-node`、`apps/cli`、`apps/desktop` 和文档。

## 背景

1.1 的 CLI / Desktop 已经可以扫描内置插件目录并运行 command，但扫描入口主要围绕单一 builtin plugin root 设计。1.2 要让 monorepo 外部插件项目可以通过显式开发参数加入扫描，并和内置插件一起参与 command list、lazy activation 和 command run history。

外部插件目录是开发期入口，不是插件安装、注册或 marketplace 机制。

## 目标

- CLI 支持一个或多个 `--plugin-dir <path>` 参数。
- Desktop 开发态支持一个或多个 `--plugin-dir <path>` 参数。
- Desktop 开发态支持 `TOOLDECK_PLUGIN_DIRS`，多个路径使用平台 path delimiter 分隔。
- 内置插件仍按现有规则自动扫描。
- 外部插件目录作为额外扫描来源加入 manifest index，不替换内置插件目录。
- 外部插件项目根目录和插件集合目录都能被扫描。
- 扫描 manifest 不 import 或执行 `manifest.runtime.entry`。
- 外部插件 command 可以通过现有 CLI / Desktop command run 流程执行，并写入 SQLite command run history。

## 非目标

1.2 中 external plugin dirs 不做：

- 插件安装、注册、启用或禁用流程。
- 用户级插件目录管理 UI。
- 插件安装包格式。
- 远程插件 registry。
- marketplace 分发。
- 插件热更新。
- 插件依赖解析。
- 不可信插件沙箱。
- 复杂启动参数转发或 deep link 路由。

## 扫描来源模型

1.2 应把插件扫描从单一 `pluginsRoot` 扩展为多个 scanning source：

```text
builtin plugin dirs
  -> current CLI / Desktop builtin plugin path

external plugin dirs
  -> explicit --plugin-dir arguments
  -> Desktop TOOLDECK_PLUGIN_DIRS entries
```

这些来源合并到同一个 `ManifestIndex`。重复 plugin id 或 command id 沿用现有 manifest index 错误，不为外部插件新增覆盖规则。

## Plugin Dir 解释规则

`--plugin-dir <path>` 可以指向两类路径：

```text
plugin project root
  -> <path>/manifest.json

plugin collection root
  -> <path>/*/manifest.json
```

扫描规则：

- 如果路径自身存在 `manifest.json`，按单个插件项目扫描。
- 否则扫描该路径的直接子目录，读取每个子目录下的 `manifest.json`。
- 不递归扫描更深层级。
- 不扫描 `node_modules`。
- 路径不存在时应输出清晰错误，指出具体外部插件目录。
- 扫描阶段只读取 manifest、locale 和必要静态文件。
- 扫描阶段不 dynamic import runtime entry，不调用 plugin `activate()`。

## Core 影响

`packages/runtime-node` 应提供可以复用的扫描能力，而不是让 CLI 和 Desktop 各自实现目录规则。

建议方向：

```text
scanPluginDirectory(source)
scanPluginSources([source])
```

其中 source 至少包含：

```ts
interface PluginScanSource {
  path: string;
  kind: "builtin" | "external";
}
```

`kind` 用于错误信息和未来诊断输出，不改变 manifest validation 语义。

## CLI 行为

CLI 保留现有内置插件自动扫描行为，并新增 `--plugin-dir`：

```bash
tooldeck list commands --plugin-dir ../my-plugin
tooldeck run hello.world --plugin-dir ../my-plugin
```

规则：

- `--plugin-dir` 可以重复传入。
- 每个 `--plugin-dir` 都作为 external scan source 额外加入扫描。
- 现有 `--plugins` root override 可以继续作为兼容或内部测试入口。
- 新的 plugin author 文档应使用 `--plugin-dir`，不推荐外部作者使用 `--plugins`。
- `tooldeck paths` 可以继续报告 builtin path；是否展示 external dirs 由具体命令参数上下文决定，不作为 1.2 必须能力。

## Desktop 行为

Desktop 开发态支持：

```bash
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-plugin
```

也支持：

```text
TOOLDECK_PLUGIN_DIRS=../my-plugin
```

规则：

- `--plugin-dir` 可以重复传入。
- `TOOLDECK_PLUGIN_DIRS` 使用 `path.delimiter` 解析多个路径。
- CLI 参数和环境变量都存在时，两者合并。
- 内置插件仍按当前 Desktop runtime path 自动扫描。
- 1.2 不要求 packaged Desktop 提供 UI 来管理外部插件目录。
- 单实例场景下第二实例参数不需要转发；external plugin dirs 由主实例启动时参数和环境变量决定。

## 运行语义

外部插件加入扫描后，仍走现有运行链路：

```text
list commands
  -> read manifest contributions
  -> no plugin activation

run command
  -> find command owner in merged manifest index
  -> lazy load manifest.runtime.entry
  -> activate plugin through @tooldeck/host-node
  -> execute registered command handler
  -> write command run history to SQLite
```

这保持 TPP v1 边界：

- Renderer 不直接访问 SQLite。
- Renderer 不直接 import 或执行插件代码。
- Manifest scanning 不激活插件 runtime。
- Command result 仍然是 structured `ContentBlock`。

## 文档影响

Plugin author 文档应使用 `--plugin-dir` 作为外部插件验证入口：

```bash
pnpm --filter @tooldeck/cli dev -- list commands --plugin-dir ../my-plugin
pnpm --filter @tooldeck/cli dev -- run hello.world --plugin-dir ../my-plugin
pnpm --filter @tooldeck/desktop dev -- --plugin-dir ../my-plugin
```

文档应明确：

- `--plugin-dir` 是可信本地开发入口。
- `--plugin-dir` 不安装插件。
- `--plugin-dir` 不替换内置插件。
- 外部插件项目需要先完成 `pnpm build`，让 `manifest.runtime.entry` 指向可加载产物。

## 验收标准

- CLI 可以通过单个 `--plugin-dir` 扫描插件项目根目录并列出 command。
- CLI 可以通过多个 `--plugin-dir` 合并扫描多个外部插件。
- CLI 可以通过 `--plugin-dir` 指向插件集合目录并扫描直接子目录插件。
- CLI 扫描外部插件时仍保留内置插件 command。
- CLI 可以运行外部插件 command，并写入 command run history。
- Desktop dev 可以通过 `--plugin-dir` 扫描外部插件项目并运行 command。
- Desktop dev 可以通过 `TOOLDECK_PLUGIN_DIRS` 扫描外部插件项目并运行 command。
- 外部插件和内置插件声明重复 command id 时，沿用现有 duplicate command id 错误。
- 扫描外部插件 manifest 不触发 runtime entry import 或 plugin activation。
