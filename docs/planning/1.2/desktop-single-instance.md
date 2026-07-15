# Desktop Single Instance

本文定义 Tooldeck 1.2 中 Desktop 单实例应用的目标、边界和验收标准。该目标用于收敛多实例启动时后续实例白屏的问题，并确保桌面端只启动一套主进程服务、插件宿主和 SQLite 连接。

## 背景

当前 Desktop 入口在 Electron `app.whenReady()` 后直接创建窗口并启动 `TooldeckDesktopService`。如果用户重复启动应用，每个进程都会尝试创建自己的 `BrowserWindow`、注册 IPC、扫描插件并初始化本地状态。

这会带来几个问题：

- 后续实例可能出现白屏或加载不完整的 renderer。
- 多个进程可能同时访问同一份 Desktop SQLite 状态。
- 多个进程可能重复扫描和激活相同插件。
- 多个进程注册相同本地服务和 IPC 生命周期，退出行为更难预测。

  1.2 应优先把 Desktop 改为单实例应用，而不是只针对白屏做局部修复。单实例可以同时解决重复主进程、重复服务和重复数据库访问的问题。

## 目标

- Desktop 默认只允许一个主实例运行。
- 第二次启动应用时不创建新的主窗口、不启动新的 `TooldeckDesktopService`、不初始化新的 SQLite 连接。
- 第二实例应把焦点交还给现有主窗口。
- 如果主窗口被最小化，第二实例应恢复窗口后再聚焦。
- 如果主窗口已关闭但应用仍在 macOS dock 生命周期中，第二次激活应按现有 `activate` 逻辑重新创建窗口。
- 单实例实现不改变 TPP manifest、activation event、command execution 或插件 SDK 协议。

## 非目标

1.2 中 Desktop 单实例不做：

- 多窗口工作区。
- 标签页、窗口会话恢复或复杂窗口管理。
- 自定义桌面端访问协议。
- 深链接路由。
- 插件安装包或插件 registry。
- 插件热更新。
- 为不可信插件增加进程级沙箱。
- 复杂启动参数转发。

第二实例的命令行参数可以先忽略，只负责聚焦已有窗口。未来如果引入 deep link 或 file handler，再单独设计参数转发和路由。

## 行为设计

Desktop 主进程启动时应在创建窗口前请求 Electron single instance lock：

```text
app start
  -> request single instance lock
  -> lock failed: quit immediately
  -> lock acquired: register second-instance handler
  -> app.whenReady()
  -> create TooldeckDesktopService
  -> register IPC
  -> create BrowserWindow
  -> load renderer
```

第二实例启动时：

```text
second app start
  -> request single instance lock fails
  -> second process exits
  -> first process receives second-instance
  -> restore main window if minimized
  -> focus main window
```

如果主实例还没有完成窗口创建，`second-instance` handler 不应创建第二套服务。它可以只记录待聚焦状态，等 `createWindow()` 完成后聚焦主窗口。

## Main Process Contract

实现建议集中在 `apps/desktop/src/main/index.ts`：

- 在 `app.whenReady()` 之前调用 `app.requestSingleInstanceLock()`。
- 如果没有拿到 lock，调用 `app.quit()` 并停止后续初始化。
- 拿到 lock 后注册 `app.on("second-instance", ...)`。
- 抽出 `focusMainWindow()`，统一处理 restore、show、focus。
- `createWindow()` 仍然是唯一启动 `TooldeckDesktopService` 和注册 IPC 的入口。
- `createWindow()` 应避免在已有 `mainWindow` 且未销毁时重复创建服务。
- `mainWindow` 的 `closed` 生命周期应清理引用，避免 stale window reference。

推荐行为：

```text
focusMainWindow()
  -> if mainWindow is undefined or destroyed: return
  -> if minimized: restore
  -> show
  -> focus
```

如果后续要支持启动参数转发，应把参数解析放在主进程层，不让 renderer 直接接触 Node、SQLite 或插件 runtime。

## Service Lifecycle

单实例的核心约束是 Desktop 后端服务只属于主实例：

- `TooldeckDesktopService` 只在主实例中启动。
- IPC 只在主实例中注册一次。
- SQLite desktop storage 只由主实例打开。
- 插件扫描和 lazy activation 仍通过现有 service/runtime-node/host-node 流程完成。
- 第二实例不能直接访问 storage、不能扫描插件、不能 import 插件 runtime entry。

这保持了 TPP v1 的边界：

- Renderer 不直接访问 SQLite。
- Renderer 不直接执行插件代码。
- Manifest scanning 不激活插件代码。
- Command execution 仍通过 main process service 写入 command history。

## Development Behavior

开发环境也应使用同一套单实例逻辑。运行 `pnpm --filter @tooldeck/desktop dev` 后，如果再次启动 Electron 进程，应聚焦已有开发窗口，而不是再创建一个白屏窗口。

开发期允许 renderer dev server 由脚本独立管理。单实例 lock 只约束 Electron app 进程，不负责启动或停止 Vite dev server。

## Error Handling

如果主实例启动失败，应保留现有失败行为：

- 输出启动错误。
- 调用 `app.quit()`。
- 避免留下半初始化的 service、IPC 或窗口引用。

如果第二实例启动时主窗口尚未创建，不应因为 `mainWindow` 为空而报错。主实例完成 `createWindow()` 后应可以正常显示窗口。

## 验收标准

- Desktop 启动后再次启动应用，不会创建第二个可见窗口。
- 第二次启动不会启动第二套 `TooldeckDesktopService`。
- 第二次启动不会注册第二套 IPC handler。
- 第二次启动不会打开第二个 SQLite desktop storage 连接。
- 如果主窗口最小化，第二次启动会恢复并聚焦主窗口。
- 如果主窗口在后台，第二次启动会聚焦主窗口。
- 单实例实现不改变 Desktop command list、command run 和 command history 行为。
- Desktop 仍可以通过显式 `--plugin-dir` 开发入口扫描额外本地插件目录并运行 command。
- CLI 行为不受影响。

## 测试建议

单元层可以把窗口聚焦逻辑拆成小函数后测试，但 Electron single instance lock 本身更适合用手动或端到端 smoke 验证。

建议最小验证：

```text
1. 启动 Desktop。
2. 再次启动 Desktop。
3. 确认只保留一个主窗口。
4. 最小化主窗口。
5. 再次启动 Desktop。
6. 确认主窗口恢复并获得焦点。
7. 运行 json.format。
8. 确认 command history 仍写入 SQLite。
```

如果后续增加 Electron E2E 测试，可以用该流程作为 smoke case。
