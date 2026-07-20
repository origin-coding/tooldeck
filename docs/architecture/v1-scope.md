# TPP V1 Scope

> **Status:** Historical Tooldeck 1.0 release scope. This is not the current 1.3 release
> checklist. See [Tooldeck 1.3 Planning and Implementation Status](../planning/1.3.md)
> for the implemented local packaging and installation lifecycle.

本文定义 `tooldeck` 当前 V1 / 1.0 发布的收口范围。长期协议方向仍以 [TPP v1 设计文档](./tpp-v1.md) 为准；早期 CLI-first 纵向切片记录见 [CLI-first TPP MVP](./cli-first-mvp.md)。

## V1 目标

V1 交付一个可信本地插件工具箱，可以通过 Desktop 和 CLI 扫描本地插件 manifest、懒激活插件、运行 command，并把核心状态写入 SQLite。

核心链路：

```text
manifest scan
  -> command list
  -> lazy plugin activation
  -> command execution
  -> ContentBlock result
  -> SQLite command history / plugin registry / plugin KV
```

## 必须支持

- Desktop 可以列出插件和 commands。
- Desktop 可以运行 `json.format`。
- CLI 可以运行 `tooldeck run json.format --text '{"a":1}'`。
- Manifest scanning 不执行插件入口文件。
- 插件只在匹配 command 被调用时激活。
- Command handler 通过 `PluginContext` 暴露的能力工作。
- Command execution 写入 SQLite command run history。
- 插件 registry 和 enabled state 写入 SQLite。
- Plugin scoped KV 通过 `ctx.storage` 使用并写入 SQLite。
- `json-tools` 提供 `json.format` 示例 command。
- `json.format` 返回结构化 `ContentBlock` output。

## V1 技术选型

```text
Electron
React
TypeScript
electron-vite
pnpm workspace
SQLite
Drizzle ORM
node:sqlite
```

V1 使用 Node 内置的 `node:sqlite` 作为 SQLite driver，并通过 Drizzle 的 `drizzle-orm/node-sqlite` adapter 访问数据库。`SQLite is an experimental feature` warning 是 V1 可接受的 Node runtime 提示。

## Runtime-node 实现边界

TPP 是语言无关协议；当前仓库的 `packages/runtime-node` 是当前可信本地 Node 纵向切片的 TypeScript runtime 实现，不是协议本身。

V1 中 `packages/runtime-node` 负责当前 Node runtime 的协调逻辑：

- manifest scanning / indexing。
- command registry 和 command orchestration。
- lazy plugin activation 协调。
- command input / output validation。
- lifecycle state machine。
- Node/TS 插件运行时契约集成；公开作者类型由 `packages/sdk-node` 提供。

V1 只实现 `packages/host-node`，用于加载可信本地 Node 插件。Desktop 和 CLI 在 app 层组合：

```text
packages/runtime-node
  + packages/host-node
  + packages/storage
```

`packages/runtime-node` 不应依赖 Electron renderer、React 或 SQLite repository。当前公开插件作者契约由 `packages/sdk-node` 提供，`runtime-node` 依赖该契约；早期由 runtime 首发契约、SDK re-export 的安排已被后续包边界收口取代。

## ContentBlock 范围

V1 只支持这些 `ContentBlock` 类型：

```ts
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "code"; text: string; language?: string }
  | { type: "json"; value: JsonValue };
```

V1 不给单个 `ContentBlock` 提供通用 `metadata` 字段。需要稳定语义时，优先增加明确字段，而不是通过任意 metadata 建立宿主和插件之间的隐式协议。

## 延后能力

以下 `ContentBlock` 类型不进入 V1：

- `markdown`
- `table`
- `file`

原因：这些类型会引入额外的渲染、安全、文件生命周期、权限、数据建模和宿主集成设计。它们需要单独设计后再作为显式协议扩展加入。

以下 manifest contribution points 也不进入 V1 实现：

- `documents`
- `tables`
- `views`
- `settings`
- `menus`
- `fileHandlers`

V1 manifest schema 保持 commands-only strict。`activationEvents` 继续由 command contribution 隐式推导，不要求插件在 manifest 中声明。

## CLI 收口清单

- `tooldeck list` 和 `tooldeck list commands` 列出 command id、plugin id、title。
- `tooldeck run json.format --text '{"a":1}'` 输出格式化 JSON。
- CLI 可读输出支持 `text`、`code`、`json` blocks。
- CLI 成功和失败 command run 都写入 SQLite。
- CLI 支持 `--plugins` 和 `--storage` 路径覆盖。
- CLI smoke 使用 build 后的 package 验证。
- CLI 不访问 Desktop renderer、Electron API 或插件内部实现。

## CLI 用法

从 workspace 运行开发态 CLI：

```bash
pnpm --filter @tooldeck/cli dev -- list
pnpm --filter @tooldeck/cli dev -- list commands
pnpm --filter @tooldeck/cli dev -- run json.format --text '{"a":1}'
```

运行 build 后的 CLI：

```bash
pnpm --filter @tooldeck/cli build
node apps/cli/dist/index.js list
node apps/cli/dist/index.js list commands
node apps/cli/dist/index.js run json.format --text '{"a":1}'
```

指定插件目录和 SQLite 路径：

```bash
node apps/cli/dist/index.js list commands --plugins ./plugins --storage ./.data/tooldeck.sqlite
node apps/cli/dist/index.js run json.format --text '{"a":1}' --plugins ./plugins --storage ./.data/tooldeck.sqlite
```

`--plugins` 接受要扫描的本地插件目录；`--storage` 接受 SQLite 数据库文件路径。相对路径按 workspace root 解析。

## Desktop 收口清单

- Desktop renderer 不直接访问 SQLite。
- Desktop renderer 不 import 或执行插件代码。
- Preload / IPC 只暴露必要的 command、plugin 和 history API。
- `pnpm check:desktop-boundaries` 用 `rg` 检查 renderer/preload/main 架构边界。
- Desktop 可以 list plugins、list commands、run `json.format`。
- Desktop command execution 写入 `source: "desktop"` 的 command history。
- Desktop plugin enable/disable 状态写入 SQLite。
- Disabled plugin 的 command 不能激活或执行。
- Command output 展示支持 `text`、`code`、`json` blocks。
- Desktop packaged app 可以找到 bundled plugins 并运行 `json.format`。

## 1.0 发布检查

- Workspace package、CLI、Desktop、示例插件 package 和插件 manifest 版本号应统一为 `1.0.0`。
- Desktop installer 文件名应来自 `apps/desktop/package.json` 的 `1.0.0` 版本，而不是手工重命名产物。
- 打包产物的 `resources/plugins` 必须包含 `json-tools` 的 `manifest.json`、`dist/index.js` 和 locales。
- 发布前需要用打包产物目录验证 `json.format` 可以扫描 bundled plugin 并成功执行。

## 明确不做

- Plugin marketplace
- Remote plugin installation
- Untrusted plugin sandbox
- WASM plugin runtime
- MCP adapter
- OpenAPI adapter
- Plugin signing
- Plugin dependency resolution
- Plugin hot reload
- Complex permission dialogs
- Complex custom view plugins
- Renderer database access
- Renderer plugin execution

## V1 验收命令

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm check:desktop-boundaries
pnpm smoke:cli
```

Desktop 还需要一次 packaged app smoke，确认打包后可以扫描 bundled plugins 并运行 `json.format`。
