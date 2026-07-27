# ADR 0006: Runtime-kind Host Registry

## Status

Accepted

## Date

2026-07-24

## Context

Tooldeck 的 TPP manifest 通过 `runtime.kind` 声明插件需要的 runtime。1.3 runtime 永久绑定一个
Node host，协议接受某个 kind 与当前产品实际提供对应 host 的两个问题没有显式分开。

Tooldeck 1.4 仍只支持可信本地 Node 插件，不实现 WASM，也不扩展 manifest schema。但在合并
`runtime-node` 和 `host-node` 时，如果继续把 plugin manager 与 Node loader 直接绑定，未来
增加 host 会同时侵入 manifest、lifecycle、command orchestration 和 application composition。

## Decision

`@tooldeck/runtime-node` 内部使用 `PluginHost` port 和 `PluginHostRegistry`。Plugin manager 根据
indexed manifest 的 `runtime.kind` 从 registry 获取 host。

目标契约：

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

1.4 只实现并注册：

```text
runtime.kind = node -> NodePluginHost
```

行为规则：

- Manifest scan 和 schema compilation 不创建、加载或调用 host。
- Host 只在匹配 capability 被调用时参与 lazy activation。
- 未注册 kind 返回 `ERR_RUNTIME_HOST_UNAVAILABLE`。
- Error details 至少包含 `pluginId`、`runtimeKind` 和 `registeredRuntimeKinds`。
- Runtime dispose 尝试释放所有已注册 host，再聚合 cleanup errors。
- Tests 可以注入 fake hosts，验证正确路由、unknown kind 和 disposal。

协议是否接受某个 runtime kind 与当前 Tooldeck application 是否注册对应 host 是两个不同的
验证阶段。Application composition 决定产品启用哪些 host。

未来新增 WASM 时，需要先显式扩展 protocol 合法 kind，再实现独立 adapter 和 ABI bridge。
Node SDK 不作为 WASM ABI。只有 host 具有独立构建、重型/native dependency 或不同产品需要
不同 host 集合时，才重新评估独立 workspace。

## Consequences

Runtime core 不再依赖具体 Node loader，可以在不改变 command validation、execution、
CommandResult 和 history pipeline 的情况下选择不同 host。Fake host 测试也不再需要执行真实
plugin entry。

代价是即使 1.4 只有 Node host，也要维护一个小型 registry 和 host-unavailable error。该抽象
必须保持窄范围，不能提前加入未实现的 WASM、process 或 remote host skeleton。

Node plugin scan 和 lazy activation 的既有行为必须通过 fixture 锁定。Registry 不能成为扫描期
实例化 host 或 eager activation 的理由。

## Alternatives Considered

### 继续把 plugin manager 绑定到 Node host

当前实现更少，但 runtime.kind 只停留在数据层，未来 host 会侵入 core orchestration。

### 为每个未来 host 建立独立 workspace

1.4 只有一个 Node host，提前拆分会增加构建和版本边界且没有独立消费者。

### 用动态 import map 直接按 kind 分支

会把 host selection、loading 和 lifecycle 混在 manager 中，不利于 fake injection 和
dispose-all。

### 在 protocol 中定义 executable host interface

TPP 应保持语言无关和 data-only，不应包含 Node function API。

## References

- [Tooldeck 1.4 Planning](../../planning/1.4.md)
- [Package Boundaries and Dependency Layers](../../planning/1.4/01-package-boundaries.md)
- [ADR 0005](./0005-public-packages-and-internal-implementation.md)
- [Issue #28](https://github.com/origin-coding/tooldeck/issues/28)
