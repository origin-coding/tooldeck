# Package Boundaries and Dependency Layers

本文定义 Tooldeck 1.4 的公开 package、私有 Node 实现、应用入口和插件项目边界。

## Status

```text
Accepted planning; implementation pending.
```

长期决定见：

- [ADR 0005: Public Packages and Internal Implementation](../../architecture/decisions/0005-public-packages-and-internal-implementation.md)
- [ADR 0006: Runtime-kind Host Registry](../../architecture/decisions/0006-runtime-kind-host-registry.md)
- [ADR 0007: ApplicationError-only Application Facade](../../architecture/decisions/0007-application-error-only-facade.md)

## Context

Tooldeck 1.3 将公开插件作者 package 和仅供 CLI/Desktop 使用的私有实现都放在 `packages/`。
与此同时：

- `runtime-node` 与 `host-node` 同进程、同版本且只有一组消费者。
- `preferences`、`storage` 和 `plugin-management-node` 都属于产品应用层。
- CLI 与 Desktop 分别组合 runtime、database、history、preferences 和 plugin management。
- `shared` 主要转发 JSON 类型并提供跨层 `TooldeckError`，缺少明确所有者。
- Runtime 永久绑定 Node host，没有按照 `manifest.runtime.kind` 显式路由。
- 跨 bundle 使用 `instanceof TooldeckError` 容易受重复构建产物影响。

## Target Packages

以下公开 package 保留名称、职责和兼容责任：

```text
@tooldeck/protocol
@tooldeck/sdk-node
@tooldeck/plugin-package
@tooldeck/plugin-tools
@tooldeck/vite-plugin
@tooldeck/create-plugin
```

私有实现只保留：

```text
@tooldeck/runtime-node
@tooldeck/application-node
```

迁移映射：

| 当前 package                       | 1.4 目标                                      |
| ---------------------------------- | --------------------------------------------- |
| `@tooldeck/runtime-node`           | 移入 `internal/runtime-node`，保留 package 名 |
| `@tooldeck/host-node`              | 合并到 `runtime-node/src/hosts/node`          |
| `@tooldeck/shared`                 | 内容按所有权迁移后删除                        |
| `@tooldeck/preferences`            | 合并到 `application-node`                     |
| `@tooldeck/storage`                | 合并到 `application-node`                     |
| `@tooldeck/plugin-management-node` | 演进并重命名为 `application-node`             |

所有 `internal/*/package.json` 必须声明 `"private": true`。

## `@tooldeck/runtime-node`

`runtime-node` 是 TPP runtime 的私有 Node.js 实现，不是 TPP 协议本身，也不表示
`manifest.runtime.kind` 只能是 `node`。

它负责：

```text
manifest scan and index
command registry and orchestration
input/output validation
lazy activation
plugin lifecycle
runtime-kind routing
host registration and selection
Node plugin loading
RuntimeError
runtime resource disposal
```

它不负责 SQLite、preferences、history persistence、plugin installation、enabled-state
persistence、purge、Electron IPC、CLI formatting 或 renderer DTO。

目标源码边界：

```text
internal/runtime-node/src/
  core/
    commands/
    lifecycle/
    manifests/
    validation/
    plugin-host.ts
  hosts/
    node/
  composition/
    create-runtime.ts
    host-registry.ts
  errors/
  index.ts
```

## Runtime-kind Routing

Runtime core 通过 `PluginHost` port 和 `PluginHostRegistry` 工作，而不是直接持有唯一 Node
host。

```ts
interface PluginHost {
  readonly kind: PluginRuntimeKind;
  hasPlugin(pluginId: string): boolean;
  activatePlugin(options: { pluginId: string; entryPath: string }): Promise<void>;
  deactivatePlugin(pluginId: string): Promise<void>;
  dispose(): Promise<void>;
}

interface PluginHostRegistry {
  register(host: PluginHost): void;
  get(kind: PluginRuntimeKind): PluginHost | undefined;
  require(kind: PluginRuntimeKind): PluginHost;
  disposeAll(): Promise<void>;
}
```

1.4 只注册：

```text
runtime.kind = node -> NodePluginHost
```

约束：

- Manifest scan 不创建、加载或调用 host。
- 匹配 command 被调用时才选择 host 并触发 lazy activation。
- 未注册的 runtime kind 返回 `ERR_RUNTIME_HOST_UNAVAILABLE`。
- 错误 details 至少包含 `pluginId`、`runtimeKind` 和 `registeredRuntimeKinds`。
- Runtime dispose 尝试释放所有 host，并在完成全部清理后聚合失败。
- 测试可以注入 fake host 验证路由。

协议接受某种 runtime kind 与当前产品注册了对应 host 是两个独立问题。1.4 不实现 WASM，
不扩展 manifest schema，也不把 Node SDK 当作未来 WASM ABI。

## `@tooldeck/application-node`

Application 单向依赖 runtime：

```text
runtime-node -> application-node -> CLI / Desktop main
```

它负责：

```text
database lifecycle and SQLite implementation
preferences
Tooldeck path and plugin source configuration
catalog synchronization and enabled-state gate
command history
plugin scoped storage
.tdplugin install / uninstall
enable / disable
retained-data purge
runtime start / rebuild / dispose
ApplicationError
```

Application 返回 host-independent use-case DTO，不返回 Electron、CLI 或 renderer 类型。

主要组合：

```text
application.start()
  -> open database
  -> create runtime and register Node host
  -> statically scan manifests
  -> synchronize catalog

application.runCommand()
  -> check enabled state
  -> runtime.runCommand()
  -> write history
  -> return CommandResult

application.dispose()
  -> dispose runtime and hosts
  -> close database
```

Runtime 需要的产品能力通过 port 注入，runtime 不得反向依赖 application。

## Application Facade and Errors

Apps 只能接收 `ApplicationError`。Runtime 内部拥有 `RuntimeError`，application 内部组合时可让
`RuntimeError | ApplicationError` 自然传播，但在 facade 出口必须统一转换：

```text
RuntimeError
  -> fromRuntimeError()
  -> ApplicationError { source: "runtime" }
  -> CLI / Desktop main
```

转换必须保留 code、message、JSON-safe details 和原始 cause。Application facade、apps 和生成的
`.d.ts` 不得泄漏 `RuntimeError` 或 `RuntimeErrorCode`。

跨 package 行为分支使用稳定 type guard，不依赖裸 `instanceof`：

```ts
function isApplicationError(error: unknown, code?: ApplicationErrorCode): error is ApplicationError;
```

错误所有权：

| 错误                                                   | 所有者                |
| ------------------------------------------------------ | --------------------- |
| Manifest、command、activation、host、runtime lifecycle | `runtime-node`        |
| Database、preferences、install、uninstall、purge       | `application-node`    |
| `.tdplugin` ZIP、路径、digest、格式                    | `plugin-package`      |
| 插件主动返回的业务失败                                 | `CommandResult.error` |
| CLI 格式和 exit code                                   | `apps/cli`            |
| IPC transport mapping                                  | `apps/desktop`        |

Transport 只包含稳定、JSON-safe 的 tag、source、code、message 和 details；不发送 stack、raw
cause、内部 Error object 或敏感信息。

## App Responsibilities

CLI 保留：

```text
argument parsing
CLI path overrides
application instance creation
text / JSON formatting
exit-code mapping
dispose
```

Desktop main 保留：

```text
Electron lifecycle and userData paths
long-lived application instance
IPC registration
Desktop contract mapping
application dispose
```

Desktop renderer/preload 不导入 internal package；renderer 不接触 SQLite 或插件代码。

## `shared` Removal

- JSON 类型直接从 `@tooldeck/protocol` 导入。
- 无消费者的 `isRecord` 删除。
- `TooldeckError` 分解为 runtime 所有的 `RuntimeError` 与 application 所有的
  `ApplicationError`。
- 不建立新的 `shared` 或 `errors` package。

删除顺序：

```text
merge runtime-node + host-node
  -> migrate RuntimeError
merge application services
  -> migrate ApplicationError and app guards
move JSON imports to protocol
  -> remove shared consumers
remove shared and old private packages
```

## Implementation Stages

### Stage 0: Compatibility baseline

- 固化公开 exports、`.d.ts`、tarball 和 CLI packed artifact。
- 固化官方支持范围内的 TPP v1 manifest 和真实 1.3 `.tdplugin` fixture。
- 固化 CommandResult、error code、cleanup 和 history 行为。

### Stage 1: Runtime consolidation

- 移动 `runtime-node`，合并 `host-node`。
- 建立 `hosts/node` 和 host registry。
- 迁移 RuntimeError，保持 lazy activation。
- 删除旧 `host-node`。

### Stage 2: Application consolidation

- 以 plugin management service 为基础建立 `application-node`。
- 合并 storage 和 preferences。
- 建立 lifecycle/use-case facade 和 ApplicationError。
- 迁移 database、history、catalog 与 plugin storage composition。

### Stage 3: App migration

- CLI/Desktop main 只消费 application facade。
- 删除重复 composition。
- 替换跨 bundle `instanceof`。
- 建立 IPC-safe error serialization。

### Stage 4: Boundaries and cleanup

- 删除 `shared` 和旧 private package。
- 清理 manifests、build config、lockfile 和 task graph。
- 增加 package/import boundary checks。
- 执行完整验证。

## Implementation Issues

1. [#29 Consolidate the Node runtime and add runtime-kind host routing](https://github.com/origin-coding/tooldeck/issues/29)
2. [#30 Consolidate Node application services](https://github.com/origin-coding/tooldeck/issues/30)
3. [#31 Migrate CLI and Desktop to the Node application service](https://github.com/origin-coding/tooldeck/issues/31)

#30 受 #29 阻塞；#31 受 #29 和 #30 阻塞。三个 Issue 都是
[Issue #28](https://github.com/origin-coding/tooldeck/issues/28) 的 sub-issues，不再增加 package
重组 umbrella Issue。

## Acceptance Criteria

- `packages/` 只包含六个公开 package，`internal/` 只包含两个私有 package。
- 旧 `host-node`、`shared`、`preferences`、`storage` 和 `plugin-management-node` 不再存在。
- Package graph 满足依赖方向且无环。
- CLI/Desktop 不直接组合 runtime；renderer/preload 不导入 internal。
- Node host 通过 registry 注册，scan 不访问 host，command 保持 lazy activation。
- 未注册 host、cleanup 聚合和 fake-host routing 有测试覆盖。
- 已知错误不降级为 `ERR_UNKNOWN`。
- Apps 只识别 `ApplicationError`，runtime 来源使用 `source: "runtime"`。
- CommandResult、history、install rollback、uninstall `cleanupPending` 和 purge 行为保持。
- 六个公开 package 及 CLI published artifact 不泄漏 internal 或 Effect 类型。
- 1.3 官方支持范围内的 TPP manifest 和 `.tdplugin` 继续可用。

## Non-goals

- 修改六个公开 package 的名称或职责。
- 实现 WASM host 或新增 runtime kind。
- Nuxt、Effect、内部 Schema 或 Ajv 的完整实施；它们由其他规划负责。
- 在 package 迁移同时全面重命名错误码。
- Marketplace、remote install、signing、sandbox 或新的 contribution。
