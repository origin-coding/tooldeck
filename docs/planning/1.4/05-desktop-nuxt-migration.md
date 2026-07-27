# Desktop Nuxt CSR Migration

本文定义 Tooldeck 1.4 Desktop renderer 从 React 到 Nuxt CSR 的等价迁移、preload bridge 边界和
直接相关的依赖治理。

## Status

```text
Accepted planning; implementation starts after major 1.4 behavior is stable.
```

长期边界见
[ADR 0009: Nuxt CSR Renderer and Preload Bridge](../../architecture/decisions/0009-nuxt-csr-renderer-and-preload-bridge.md)。

## Timing

```text
finish major 1.4 behavior changes
  -> stabilize pages and Desktop contracts
  -> split the preload bridge by domain
  -> migrate to Nuxt CSR
  -> verify packaged Desktop
  -> enter planning 6 cleanup
```

Nuxt 迁移不承担新增产品功能。迁移期间只做现有页面/交互等价替换、renderer 路由和状态调整、
bridge 收敛、直接相关依赖替换及构建回归。

## Target Renderer Stack

```text
Nuxt CSR
Vue 3
TDesign Vue Next
UnoCSS
Pinia
@nuxtjs/i18n
```

Nuxt 只进入 renderer：

```ts
export default defineNuxtConfig({
  ssr: false,
});
```

生产环境生成静态资源并由 Electron `loadFile` 加载。不引入 SSR、Nitro、内嵌 HTTP server、
server API routes，也不把 Nuxt composable 引入 main/preload。

如果 `file://` 下 history routing 不可靠，采用 hash route。最终决定以 packaged Electron
验证为准。

## Routing and State

目标页面形态：

```text
/plugins
/plugins/:pluginId
/commands
/commands/:commandId
/history
/history/:commandId
/settings
```

文件路由和 URL 是页面选择状态的唯一来源。Pinia 不保存当前页面、选中 plugin/command id 或
其他与 URL 重复的导航状态。

Pinia 主要保存：

```text
plugin catalog and enabled state
command catalog
command run state
history
preferences
cross-page async loading state
```

具体页面拆分在 renderer contract 稳定后根据实际功能冻结。

## UI and Styling

- TDesign 负责 Button、Input、Select、Form、Dialog、Table、Notification、Message、theme 和
  component state。
- UnoCSS 负责 layout、spacing、size、辅助样式和少量 responsive rules。
- 不用 UnoCSS 重建 TDesign 已有的复杂组件。
- 初始 Nuxt modules 为 `@pinia/nuxt`、`@nuxtjs/i18n`、`@unocss/nuxt`。
- TDesign 先作为普通 Vue library 使用；只有官方 module 带来明确收益并通过 Electron 构建时
  才引入。

## I18n

- UI i18n 使用 `@nuxtjs/i18n`。
- Route 不增加 locale prefix。
- 不根据浏览器语言自动改变应用偏好。
- 当前 locale 由 Tooldeck preferences 决定。
- TDesign locale 与 application locale 同步。
- TPP `LocalizedString` 仍是协议数据，不与 renderer translation resources 混合。

## Preload Bridge

保持唯一根对象：

```ts
window.tooldeck;
```

按领域拆分：

```ts
window.tooldeck.commands.list();
window.tooldeck.commands.run();

window.tooldeck.plugins.list();
window.tooldeck.plugins.setEnabled();
window.tooldeck.plugins.installDroppedPackage();
window.tooldeck.plugins.uninstall();
window.tooldeck.plugins.purgeData();
window.tooldeck.plugins.rescan();

window.tooldeck.preferences.list();
window.tooldeck.preferences.get();
window.tooldeck.preferences.set();

window.tooldeck.history.listRuns();
```

契约和实现可以拆文件，但 preload 最终只调用一次：

```ts
contextBridge.exposeInMainWorld("tooldeck", api);
```

边界：

- Renderer 不接触 `ipcRenderer` 或通用 `invoke(channel, payload)`。
- IPC channel 由 main/preload 内部管理。
- Preload 负责 Electron-specific conversion。
- Main 将 application result 映射为 Desktop contract。
- Renderer 只依赖 host-independent DTO。
- Raw Error、SQLite object 和 runtime object 不跨 bridge。

Bridge 拆分先于 renderer 切换完成。

## Dependency Classification

依赖按最终 artifact 分类：

```text
loaded externally by the packaged app -> dependencies
development/test/build-only or bundled -> devDependencies
```

- `electron-updater` 保留在 `dependencies`。
- Electron、build tools 和 renderer stack 放在 `devDependencies`。
- 被 main/preload bundle 内联的 `@tooldeck/*` 可以放在 `devDependencies`。
- 以脱离仓库 `node_modules` 的安装包 smoke 证明分类正确。

Nuxt 等价迁移后删除 React renderer 依赖，包括 React、React DOM、Ant Design、Zustand、
React i18n、React-specific icons/styles 和 Tailwind 相关项。

## Desktop Development Script

确认删除：

```text
concurrently
cross-env
wait-on
```

不引入替代 orchestration package。`scripts/dev.mjs` 继续使用 `node:child_process` 管理 renderer
dev server、main/preload watch、Electron 和 built-in plugin 准备。

环境变量通过 `spawn(..., { env })` 传入。使用原生 helper 替代 `wait-on`：

```ts
async function waitForHttp(url: string, options: WaitOptions): Promise<void>;

async function waitForFile(filePath: string, options: WaitOptions): Promise<void>;
```

Helper 必须支持 timeout、AbortSignal、连接/文件重试、其他错误快速失败、异步轮询和 timer/
child-process cleanup。日志继续使用带 `[dev]`、`[renderer]`、`[main]`、`[preload]`、
`[electron]`、`[builtin-plugins]` 前缀的原生 console。

## pnpm Catalog

Catalog 只统一重复外部依赖版本，不改变 dependency/devDependency/peerDependency 语义。

初始候选：

```yaml
catalog:
  "@types/node": ^25.9.1
  ajv: ^8.20.0
  citty: ^0.2.2
  consola: ^3.4.2
  typescript: ^6.0.3
  vite: ^8.0.16
```

不纳入：

- `workspace:*` internal dependencies。
- 只被一个 package 使用的 dependency。
- 仅 Desktop 使用的 Nuxt/Vue/Pinia/TDesign/UnoCSS。
- 需要不同兼容范围的 peer dependency。

公共 peer range 保持真实兼容范围，workspace dev version 可使用 Catalog。发布前必须检查
tarball 不含 `catalog:`。

低风险 Catalog 改造可以在主要开发期间独立落地，不扩大为全仓库依赖清理。

## Implementation Stages

1. 主要行为开发期间保持现有 renderer；可独立落地 Catalog 和确认安全的 dev-script cleanup。
2. 稳定 Desktop contract，按领域拆 bridge，以原生 readiness helper 替换 `wait-on`。
3. 建立 Nuxt CSR，迁移 routing、TDesign、UnoCSS、Pinia 和 i18n，按页面等价替换。
4. 删除旧 React renderer 及直接依赖，验证 dev、production static loading 和 packaged app。
5. 把更广泛的依赖、配置、命名和历史代码审计交给规划 6。

## Implementation Issues

1. [#38 Adopt pnpm Catalog and simplify development orchestration](https://github.com/origin-coding/tooldeck/issues/38)
2. [#39 Split the preload bridge by domain](https://github.com/origin-coding/tooldeck/issues/39)
3. [#40 Migrate the renderer to Nuxt CSR](https://github.com/origin-coding/tooldeck/issues/40)

#38 是可独立落地的低风险基础工作。#39 受 apps migration #31 阻塞。#40 受 #31、内部 Schema
决策 #34、Ajv/tooling 收敛 #37、Desktop 基础工作 #38 和 bridge #39 阻塞，确保 renderer
迁移在主要行为与 contract 稳定后开始。

## Acceptance Criteria

- 主要行为稳定后才开始 renderer 迁移。
- Renderer 使用 Nuxt CSR，production 不依赖 HTTP server。
- Navigation 由 file route/URL 驱动，Pinia 不重复保存 route state。
- TDesign、UnoCSS、Pinia 和 i18n 在 dev 与 packaged app 中工作。
- `window.tooldeck` 保持单一根 bridge 并按领域拆分。
- Renderer 不接触 raw IPC、SQLite 或 plugin runtime。
- `concurrently`、`cross-env`、`wait-on` 删除；readiness helper 支持 timeout/cancel/cleanup。
- React renderer 及确认无用的依赖在等价迁移后删除。
- Installer 只携带实际外部 runtime dependency，脱离 workspace `node_modules` 可运行。
- Catalog 不改变 dependency group 语义，公共 tarball 不含 `catalog:`。
- Plugin list/run/history/preferences/install/disable/enable/uninstall/purge 行为保持。

## Non-goals

- 在迁移中新增大规模产品功能。
- 重写 Electron main 或 application service。
- SSR、Nitro 或 renderer server API。
- 暴露 raw IPC、SQLite 或 plugin runtime。
- 借迁移提前重构所有公开 package。
- 无差别把所有依赖加入 Catalog。
- 替代规划 6 的全仓库 cleanup。
