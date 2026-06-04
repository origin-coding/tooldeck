# TPP Capability、Task 与有状态能力备忘录

本文记录 TPP 中短调用能力、长任务和有状态交互能力的设计边界。当前结论用于指导后续架构实现，不代表 CLI-first MVP 需要立即完整实现 Task、Job、View 或 Session。

## 核心结论

TPP 中应该把 `Capability` 设计为简短、一次性、无状态的 request/response 调用。

典型 capability：

```text
command run
document resolve/read
table query
file handler invocation
view open/init request
```

`Capability` 不应该承担多步骤 workflow、长时间后台任务或交互式 session 的职责。

需要跨调用保存状态的场景，后续通过独立模型表达：

```text
Task / Job  长时间、可追踪、可取消、可重试的后台工作
View        有 UI 生命周期的交互式界面
Session     多轮、有上下文、有连接状态的运行时会话
```

一句话：

```text
Capability = short stateless invocation
Task / Job = long-running stateful work
View       = interactive surface
Session    = stateful runtime context
```

## 为什么不把所有能力都设计成 Command

`Command` 是一种 capability，但 capability 不等于 command。

不建议把 Document、Table、View 等设计成 Command 的特化。它们应该在协议层保持独立 contribution type，在 runtime 层共享能力调用流水线。

原因：

- Command 表达执行动作。
- Document 表达文档资源解析和读取。
- Table 表达结构化数据查询。
- View 表达可交互 UI 入口。
- 它们的输入、输出、缓存、展示和错误语义不同。

推荐分层：

```text
Protocol layer:
  contributes.commands
  contributes.documents
  contributes.tables
  contributes.views

Runtime layer:
  shared capability invocation pipeline
```

也就是：

```text
Command / Document / Table / View 是不同 capability kind。
CapabilityInvocationLifecycleMachine 是共享的调用生命周期。
```

## Capability 调用生命周期

当前通用 capability invocation 状态机适合一次性调用：

```text
pending
  -> validationStarted
validating
  -> validationSucceeded
ready
  -> executionStarted
running
  -> executionSucceeded
succeeded
```

失败路径：

```text
validating -> validationFailed -> failed
running    -> executionFailed  -> failed
```

状态含义：

- `pending`: 调用已创建，但尚未开始校验。
- `validating`: 正在校验 contribution、插件状态、权限、输入参数或查询条件。
- `ready`: 校验通过，准备执行。
- `running`: 正在调用 handler、resolver、provider 或 host 操作。
- `succeeded`: 调用成功完成。
- `failed`: 调用失败完成。

不同 capability 可以复用这条生命周期：

```text
Command:
  validate inputSchema -> ready -> run command handler

Document:
  validate document id / locale / source -> ready -> read or resolve document

Table:
  validate query / filter / pagination -> ready -> query table provider

View:
  validate view id / policy -> ready -> open or initialize view
```

失败阶段不需要拆成多个 failed state。推荐把失败阶段写入 context、error metadata 或 history：

```text
validation
execution
outputValidation
permission
activation
```

## 有状态场景

大多数 MVP 能力是一次性、无状态调用，例如：

```text
json.format
json.validate
base64.encode
hash.sha256
document.read
table.query
```

但 TPP 后续会遇到多步骤或有状态能力，例如：

- 向导式工具：import CSV -> map columns -> preview -> confirm import。
- 长任务：batch convert files、crawl site、export report。
- 用户确认：delete files、apply patch、run shell command。
- 外部认证：OAuth login -> callback -> retry API call。
- 交互式 session：SQL client、REPL、AI chat、debugger。
- 复杂 View：regex tester、workflow editor、database browser。

这些不应该强行塞进 `CapabilityInvocationLifecycleMachine`。

## Task / Job

Task 或 Job 适合表达长时间、可追踪的后台工作。

典型状态机可以后续单独设计：

```text
created
  -> queued
  -> running
  -> completed
```

失败和控制路径：

```text
running -> failed
running -> canceling -> canceled
running -> waitingForInput
waitingForInput -> running
```

适合 Task / Job 的能力：

- 批量文件转换。
- 目录扫描或索引。
- 导出报告。
- 长时间网络同步。
- 大数据表处理。

Command 可以启动 Task，但 Command 本身不应该变成长任务。

示例方向：

```ts
{
  status: "success",
  blocks: [
    {
      type: "text",
      text: "Export started."
    }
  ],
  metadata: {
    taskId: "task_123"
  }
}
```

未来如果协议需要更正式的延续模型，可以引入：

```ts
{
  continuations: [
    {
      kind: "task",
      id: "task_123",
    },
  ];
}
```

但 v1 不建议立即实现 continuation 协议。

## View

View 表达有 UI 生命周期的交互式界面。

View 不应该直接依赖宿主 React/Vue，也不应该直接访问 Electron API。View 后续应通过标准 bridge 或 RPC 调用宿主能力。

可能的 View 生命周期：

```text
declared
  -> opening
  -> active
  -> hidden
  -> closing
  -> closed
```

失败路径：

```text
opening -> failed
active  -> failed
```

适合 View 的能力：

- regex tester。
- SQL client。
- workflow editor。
- database browser。
- visual diff tool。

View 可以调用 Command，也可以 attach 到 Session，但 View 本身不是 Command。

## Session

Session 表达多轮、有上下文、有连接状态的运行时会话。

可能的 Session 生命周期：

```text
creating
  -> active
  -> idle
  -> closing
  -> closed
```

失败和过期路径：

```text
creating -> failed
active   -> failed
idle     -> expired
expired  -> closed
```

适合 Session 的能力：

- database connection session。
- REPL。
- OAuth flow。
- AI chat。
- debugger session。
- remote shell session。

Session 可以暴露 actions 或 commands，但它本身代表状态ful runtime context。

## 推荐关系

长期可以这样组合：

```text
Command can start Task
Command can open View
Command can create Session
View can call Command
View can attach to Session
Task can emit progress/events
Session can expose actions
```

但不要反过来让 Command 吞掉所有模型。

推荐边界：

```text
Capability:
  request/response，短调用，无跨调用状态。

Task / Job:
  后台工作，有进度，有取消/失败/完成状态。

View:
  用户可交互 UI surface，有打开/关闭生命周期。

Session:
  多轮上下文，有连接、空闲、关闭、过期等状态。
```

## v1 实现建议

当前 v1 应先做稳 Capability：

- Manifest 静态声明 capability。
- 扫描 manifest 不执行插件代码。
- 调用 capability 时懒激活 owning plugin。
- 通过 `CapabilityInvocationLifecycleMachine` 记录一次调用阶段。
- Command 返回 `CommandResult` / `ContentBlock[]`。
- Document 和 Table 后续作为独立 capability kind 扩展，而不是伪装成 Command。

暂不实现：

- 通用 workflow engine。
- Task / Job runtime。
- Session runtime。
- 复杂 View 插件。
- continuation 协议。

后续新增 Task / Job / View / Session 时，应该各自定义独立 lifecycle machine，而不是扩展 CapabilityInvocationLifecycleMachine 到过度复杂。
