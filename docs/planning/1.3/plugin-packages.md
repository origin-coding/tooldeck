# Plugin Packages

本文定义 Tooldeck 1.3 中新增 `@tooldeck/plugin-packages` 包的职责、边界和验收标准。

## 定位

`@tooldeck/plugin-packages` 是 `.tdplugin` 包格式的共享实现包。它负责 package container 的读写和安全校验，不负责插件运行时、安装状态持久化或 UI。

该包服务于两个方向：

```text
@tooldeck/plugin-tools
  -> pack / dist 时写入 .tdplugin

CLI / Desktop install service
  -> install 时读取、校验、解包 .tdplugin
```

## 职责

P0 职责：

- 写入 `.tdplugin` zip 包。
- 读取 `.tdplugin` zip 包。
- 读取和校验 `tooldeck-package.json`。
- 校验 package file list。
- 校验 root `manifest.json`。
- 通过 `@tooldeck/protocol` 校验 manifest 基础结构。
- 防路径穿越。
- 禁止绝对路径。
- 防 symlink escape。
- 拒绝 `node_modules`。
- 提供 package digest helper。

## 非职责

`@tooldeck/plugin-packages` 不负责：

- 扫描 builtin / installed / external plugin sources。
- 创建 `ManifestIndex`。
- 懒激活插件。
- dynamic import runtime entry。
- 写 SQLite。
- 管理 installed plugin directory。
- 管理 enable / disable。
- Electron IPC。
- Desktop renderer 交互。

这些职责分别属于 runtime、storage、CLI 或 Desktop service。

## 依赖边界

允许依赖：

- `@tooldeck/protocol`
- zip 处理库
- Node 标准库

不允许依赖：

- `@tooldeck/runtime-node`
- `@tooldeck/host-node`
- `@tooldeck/storage`
- `@tooldeck/sdk-node`
- Electron
- React

## API 方向

P0 可以提供以下能力方向，具体命名由实现阶段决定：

```ts
readTooldeckPackage(path)
validateTooldeckPackage(path)
packTooldeckPlugin(options)
unpackTooldeckPackage(options)
computePackageDigest(path)
```

这些 API 应返回结构化结果或抛出包含可行动信息的错误。错误信息应包含：

- package path
- entry path
- manifest path
- field path
- violation reason

## 安全校验

安全校验至少包含：

- 只接受 `.tdplugin` 文件。
- 限制包大小。
- 限制文件数量。
- 所有 entry 必须是相对路径。
- 禁止 `..` 路径穿越。
- 禁止绝对路径。
- 禁止 `node_modules`。
- 解包不得写出目标目录。
- symlink 不得 escape 目标目录。
- `tooldeck-package.json.files` 必须与实际普通文件完全一致。

具体大小和文件数量阈值可在实现阶段确定，但 P0 应保留配置入口或常量，避免阈值散落在 CLI/Desktop 中。

## Runtime entry 校验边界

`@tooldeck/plugin-packages` 可以读取 manifest 并解析 `manifest.runtime.entry`。但它不应 import runtime entry，也不应检查 default export 是否像 Tooldeck plugin。

`tooldeck-plugin check --built` 可以继续做 built output 形态检查；install service 可以检查 runtime entry 文件存在，并确保路径在解包目录内。

## 验收标准

- 可以打包一个标准 Node 插件项目。
- 可以读取一个合法 `.tdplugin` 包。
- 缺少 `manifest.json` 时失败。
- 缺少 `tooldeck-package.json` 时失败。
- `files` 不匹配时失败。
- 包内有 `node_modules` 时失败。
- 包内有路径穿越时失败。
- 包内有绝对路径时失败。
- package digest helper 对同一文件输出稳定 digest。
