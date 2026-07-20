# Desktop Drag Drop Install

> **Status:** Implemented in Tooldeck 1.3, including installed-plugin uninstall and
> retained-data purge. The planning text below preserves the original P1 sequencing.

本文定义 Tooldeck 1.3 中 Desktop 拖拽安装 `.tdplugin` 的窄入口。该能力属于 P1，可以在 CLI 安装闭环稳定后实现。

## 背景

1.3 P0 以 CLI 安装闭环为主。Desktop 不需要在 1.3 中完成完整文件关联、deep link 或 router 改造，但可以提供一个插件页窄入口：

```text
用户把 .tdplugin 拖到插件页
  -> renderer 接收 drop
  -> preload 获取 file path
  -> main process 执行安装
  -> 安装成功后刷新插件列表
```

## 目标

- 插件页支持拖拽一个 `.tdplugin` 文件安装。
- 安装逻辑复用 CLI install service 或共享 service。
- 安装成功后刷新 plugin list 和 command list。
- 安装失败显示清晰错误。
- 不暴露通用 file path API 给 renderer。

## 推荐链路

```text
Renderer PluginWorkbench
  -> drop .tdplugin File
  -> window.tooldeck.installDroppedPluginPackage(file)

Preload
  -> webUtils.getPathForFile(file)
  -> ipcRenderer.invoke("tooldeck:install-plugin-package", { path })

Main IPC
  -> TooldeckDesktopService.installPluginPackage(path)

Install Service
  -> validate package
  -> unpack to temp
  -> validate manifest without activation
  -> copy to installed plugin dir
  -> write storage install record
  -> rescan plugin sources
  -> return installed plugin summary
```

## Preload 边界

不要暴露：

```ts
getDroppedFilePath(file): string
```

更好的方式：

```ts
installDroppedPluginPackage(file): Promise<InstalledPluginSummary>
```

preload 内部拿路径并直接发 IPC，避免 renderer 获取完整本地路径。

## Renderer 行为

P1 最小交互：

- 插件页接受 drop。
- 一次只接受一个文件。
- 非 `.tdplugin` 文件直接拒绝。
- 多文件 drop 直接拒绝。
- 安装期间显示 loading。
- 成功后刷新 catalog。
- 失败后显示错误。

不要求复杂安装向导。

## Main / Service 行为

Desktop install 应复用和 CLI 相同的安装规则：

- validate extension。
- validate package metadata。
- validate manifest。
- validate runtime entry exists。
- reject duplicate plugin id。
- reject duplicate command id。
- reject path traversal。
- reject symlink escape。
- reject `node_modules`。
- install 到 `installed-plugins/<sanitized-plugin-id>/`。
- write `plugin_installs`。
- rescan。
- failure rollback。

## 非目标

Desktop drag-drop install 不做：

- OS 文件关联。
- 双击 `.tdplugin` 打开 Tooldeck。
- `tooldeck://` deep link。
- 第二实例参数转发。
- Desktop router。
- marketplace UI。
- 复杂权限弹窗。
- replace / update UI。

这些属于 1.4 或后续 Desktop 导航/系统集成能力。

## 验收标准

- 拖拽一个合法 `.tdplugin` 到插件页可以安装。
- 安装后插件显示为 source kind installed。
- 安装后 command 可运行。
- command run 写入 SQLite history。
- 拖拽多个文件被拒绝。
- 拖拽非 `.tdplugin` 文件被拒绝。
- 安装失败不留下半安装目录。
- renderer 不获得通用本地文件路径 API。

## Desktop Uninstall

P1 可选支持卸载 `sourceKind = installed` 的插件：

- 复用 CLI uninstall service。
- 不允许卸载 builtin 或 external 插件。
- 卸载后刷新 plugin list 和 command list。
- 保留 plugin KV、command history 和 `plugin_states`。
