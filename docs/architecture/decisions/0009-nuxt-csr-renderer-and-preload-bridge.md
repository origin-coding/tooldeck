# ADR 0009: Nuxt CSR Renderer and Preload Bridge

## Status

Accepted

## Date

2026-07-24

## Context

Tooldeck Desktop 1.3 renderer 使用 React、Ant Design 和 Zustand。页面选择与当前 entity id
主要由 store state 表达，没有真实页面路由。1.4 计划迁移到 Nuxt/Vue 前端栈，同时必须保持
Electron main、preload、application service、SQLite 和 plugin runtime 的既有安全与职责边界。

如果迁移同时把 Nuxt server、raw IPC 或 internal package 引入 renderer，会把纯 UI 工程迁移
扩大为 Electron/backend 重写。反过来，如果 preload 继续暴露粗粒度或通用 IPC，Nuxt
composable/store 会依赖 transport 细节，难以维持 host-independent contract。

## Decision

Desktop renderer 使用纯 Nuxt CSR：

```ts
export default defineNuxtConfig({
  ssr: false,
});
```

目标 renderer stack：

```text
Nuxt + Vue 3
TDesign Vue Next
UnoCSS
Pinia
@nuxtjs/i18n
```

Nuxt 只用于 renderer。生产环境生成静态资源，由 Electron `loadFile` 加载。不使用 SSR、Nitro、
内嵌 HTTP server 或 server API routes；main/preload/application 不导入 Nuxt composable。

页面导航由 Nuxt file routing 与 URL 驱动。Pinia 保存 domain data 和跨页面 async state，不保存
与 route 重复的页面名或选中 entity id。若 `file://` 下 history route 不可靠，则使用 hash
route，并以 packaged Electron navigation/refresh smoke 为最终依据。

Preload 继续只暴露一个根对象：

```text
window.tooldeck
```

根对象按 `commands`、`plugins`、`preferences` 和 `history` 等领域拆分窄方法。Contract 和实现可
拆成多个文件，但只调用一次 `contextBridge.exposeInMainWorld("tooldeck", api)`。

边界：

- Renderer 不接触 `ipcRenderer` 或通用 `invoke(channel, payload)`。
- Renderer 不导入 `internal/*`，不访问 SQLite，不加载或执行 plugin code。
- Preload 管理 Electron-specific transport conversion。
- Desktop main 调用 `application-node` 并映射 host-independent DTO。
- Raw Error、ApplicationError object、SQLite object、runtime object 和 IPC channel 不跨 bridge。
- Error transport 只使用稳定 JSON-safe contract。

Bridge domain split 先于 renderer switch 完成。Nuxt migration 在主要 1.4 behavior 和 Desktop
contracts 稳定后进行，原则上只做现有页面、交互和状态的等价迁移。

Renderer 使用 `@nuxtjs/i18n`，locale 由 Tooldeck preferences 决定，路由不增加 locale prefix，
也不根据浏览器语言自动改变应用偏好。TPP `LocalizedString` 仍是协议数据，不与 UI translation
resources 合并。

## Consequences

Desktop 获得真实路由和领域化 state/bridge，renderer framework 与 Electron/backend 保持隔离。
未来 UI 代码可以围绕 Nuxt pages、composables 和 Pinia stores 组织，而不暴露通用 IPC。

迁移需要等价重写现有 React pages/components/tests，并在完成后删除 React、Ant Design、
Zustand、React i18n、Tailwind 和对应 build config。迁移期间不能长期维护两套 renderer。

`file://` routing、static asset paths 和 packaged app behavior 不能只由 dev server 证明；需要
Electron packaged smoke。TDesign/UnoCSS 职责必须分开，避免用 utility CSS 重建复杂 component。

Nuxt 和 renderer dependencies 属于 build/bundled dependencies 时放在 `devDependencies`；最终
分类由 installer 脱离 workspace `node_modules` 的 smoke 验证，而不是只看 source import。

## Alternatives Considered

### 保留 React，只增加 router

可以减少迁移成本，但不满足 1.4 已确认的 Nuxt/Vue 工程栈方向。

### 使用 Nuxt SSR 或 Nitro

Desktop renderer 不需要服务端渲染；引入 server 会增加启动、打包和安全边界。

### Renderer 直接使用 `ipcRenderer`

会泄漏 transport/channel，实现难以测试，并破坏 preload isolation。

### 暴露通用 `window.tooldeck.invoke`

虽然 bridge 表面仍单一，但 renderer 可绕过领域 contract，因此不采用。

### 为每个领域暴露多个全局根对象

会扩大全局 namespace 和 preload surface；单一根对象下分域更稳定。

### 同时维护 React 与 Nuxt

会产生行为、状态和测试漂移。迁移允许短期过渡，但完成后必须删除旧 renderer。

## References

- [Tooldeck 1.4 Planning](../../planning/1.4.md)
- [Desktop Nuxt CSR Migration](../../planning/1.4/05-desktop-nuxt-migration.md)
- [ADR 0005](./0005-public-packages-and-internal-implementation.md)
- [ADR 0007](./0007-application-error-only-facade.md)
- [Issue #28](https://github.com/origin-coding/tooldeck/issues/28)
