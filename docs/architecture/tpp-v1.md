# tooldeck 项目设计文档

## 1. 项目定位

项目名：`tooldeck`

`tooldeck` 是一个桌面工具箱应用，目标是通过一套自定义插件协议，让不同工具能力可以同时服务于：

- Desktop UI
- CLI
- 可选本地 API Server
- 未来可能的 AI / MCP / 自动化入口

项目不是单纯做 Electron 插件，也不是 Tauri 插件，而是设计一套独立的工具箱插件协议。

协议暂定名：

```text
TPP = Toolbox Plugin Protocol
```

核心思想：

```text
插件不是 UI 组件，而是一组可声明、可调用、可展示、可授权的能力。
```

不要把插件设计成：

```text
Tool 插件
CheatSheet 插件
Table 插件
```

而应该设计成：

```text
Plugin
  ├─ contributes.commands
  ├─ contributes.documents
  ├─ contributes.tables
  ├─ contributes.views
  ├─ contributes.menus
  ├─ contributes.settings
  └─ contributes.fileHandlers
```

对应关系：

| 旧概念     | TPP 新概念               | 本质          |
| ---------- | ------------------------ | ------------- |
| Tool       | Command                  | 可执行能力    |
| CheatSheet | Document                 | 文档资源      |
| Table      | Table Provider           | 结构化数据源  |
| 自定义控件 | View                     | 复杂自定义 UI |
| 插件配置   | Settings                 | 可声明配置项  |
| 插件入口   | Menus / Commands / Views | 宿主挂载点    |

---

## 2. 第一版技术选型

第一版优先使用：

```text
Electron
TypeScript
electron-vite
pnpm workspace
SQLite
Drizzle ORM
better-sqlite3
React
```

暂定：

```text
桌面端：Electron + React + Vite
插件运行时：Node Plugin Host
数据库：SQLite
ORM：Drizzle ORM
包管理：pnpm workspace
项目结构：MonoRepo
```

后续可选增强：

```text
WASM Plugin Host
Tauri Adapter
MCP Adapter
OpenAPI Adapter
HTTP Plugin
CLI Plugin
DuckDB Analytics
```

第一版不要做复杂生态化，先做可信本地插件。

---

## 3. MonoRepo 结构

推荐目录：

```text
tooldeck/
  apps/
    desktop/
      # Electron 桌面端

    cli/
      # 命令行入口

    api-server/
      # 可选，本地 HTTP API Server，第一版可暂不实现

  packages/
    protocol/
      # TPP 类型定义、Manifest JSON Schema、Contribution 类型

    core/
      # PluginManager、CommandRegistry、DocumentRegistry、TableRegistry

    sdk/
      # 插件开发者使用的 definePlugin、PluginContext 类型

    host-node/
      # Node 插件宿主，负责加载 JS/TS 插件

    runtime/
      # 生命周期、激活事件、Disposable、事件总线

    i18n/
      # LocalizedString、locale resolver

    storage/
      # SQLite schema、migration、repository

    ui-schema/
      # JSON Schema → UI hint → 表单描述

    shared/
      # 通用工具、错误类型、日志类型

  plugins/
    json-tools/
      # 示例插件

    regex-tools/
      # 示例插件

    http-cheatsheet/
      # 示例插件

  examples/
    minimal-plugin/
    cli-only-plugin/
    view-plugin/

  docs/
    protocol/
    plugin-authoring/
    architecture/

  scripts/
    create-plugin.ts
    validate-manifest.ts

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

第一版可以简化成：

```text
tooldeck/
  apps/
    desktop/
    cli/

  packages/
    protocol/
    core/
    sdk/
    host-node/
    storage/
    shared/

  plugins/
    json-tools/

  docs/
```

---

## 4. TPP v1 范围

第一版 TPP 只实现核心机制。

必须支持：

```text
Manifest
commands
documents
tables
settings
menus
activationEvents
activate / deactivate
PluginContext
Disposable
Content Blocks
LocalizedString
SQLite plugin registry
SQLite command history
Plugin scoped KV
Desktop 入口
CLI 入口
```

第一版暂不完整实现：

```text
插件市场
不可信插件沙箱
WASM 插件
MCP Adapter
OpenAPI Adapter
插件签名
插件依赖解析
插件热更新
远程插件
复杂权限审计
```

第一版明确假设：

```text
插件是可信的
插件主要由项目开发者自己维护
不开放第三方插件市场
不运行不可信代码
```

---

## 5. Manifest 设计

Manifest 是插件的静态声明。宿主读取 Manifest 后，即使不激活插件，也应该知道插件提供了哪些能力。

示例：

```json
{
  "schemaVersion": "1.0",
  "id": "dev.example.json-tools",
  "name": {
    "key": "plugin.name",
    "default": "JSON Tools"
  },
  "description": {
    "key": "plugin.description",
    "default": "Tools for formatting, validating, and learning JSON."
  },
  "version": "1.0.0",
  "runtime": {
    "kind": "node",
    "entry": "./dist/index.js"
  },
  "defaultLocale": "en",
  "locales": {
    "en": "./locales/en.json",
    "zh-CN": "./locales/zh-CN.json"
  },
  "activationEvents": [
    "onCommand:json.format",
    "onDocument:json.cheatsheet",
    "onTable:json.examples"
  ],
  "permissions": [
    {
      "id": "clipboard:write",
      "reason": {
        "key": "permissions.clipboardWrite.reason",
        "default": "Copy command results to the clipboard."
      }
    },
    {
      "id": "storage:plugin",
      "reason": {
        "key": "permissions.storage.reason",
        "default": "Save plugin settings."
      }
    }
  ],
  "contributes": {
    "commands": [],
    "documents": [],
    "tables": [],
    "views": [],
    "settings": [],
    "menus": []
  }
}
```

---

## 6. Contribution 设计

核心类型：

```ts
interface PluginContributes {
  commands?: CommandContribution[];
  documents?: DocumentContribution[];
  tables?: TableContribution[];
  views?: ViewContribution[];
  settings?: SettingContribution[];
  menus?: MenuContribution[];
}
```

### 6.1 Command

Command 表示一个可执行工具能力。

```ts
interface CommandContribution {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  category?: LocalizedString;
  inputSchema?: JsonSchema;
  outputSchema?: JsonSchema;
  resultView?: ResultViewHint;
}
```

示例：

```json
{
  "id": "json.format",
  "title": {
    "key": "commands.format.title",
    "default": "Format JSON"
  },
  "description": {
    "key": "commands.format.description",
    "default": "Format JSON text with custom indentation."
  },
  "inputSchema": {
    "type": "object",
    "required": ["text"],
    "additionalProperties": false,
    "properties": {
      "text": {
        "type": "string",
        "title": "JSON Text",
        "description": "Input JSON text.",
        "minLength": 1,
        "x-i18n": {
          "title": "schema.format.text.title",
          "description": "schema.format.text.description"
        }
      },
      "indent": {
        "type": "integer",
        "title": "Indent Size",
        "default": 2,
        "minimum": 0,
        "maximum": 8,
        "enum": [2, 4],
        "x-i18n": {
          "title": "schema.format.indent.title"
        }
      }
    }
  }
}
```

`inputSchema` 语义应尽量保持 JSON Schema 标准兼容。必填、默认值、范围、字符串长度、枚举和额外字段控制分别使用 `required`、`default`、`minimum` / `maximum`、`minLength` / `maxLength`、`enum`、`additionalProperties` 等标准字段。

MVP 实现备忘：当前只实现标准 JSON Schema 语义和 `x-i18n` 翻译 key。`x-ui`、`x-cli` 暂时不作为 v1 MVP 的实现目标，后续只作为宿主展示和交互提示扩展，不改变数据校验语义。

### 6.2 Document

Document 表示 Markdown / HTML / Text 文档资源。CheatSheet 属于 Document。

```ts
interface DocumentContribution {
  id: string;
  title: LocalizedString;
  format: "markdown" | "html" | "text";
  source: LocalizedFile;
  tags?: string[];
  searchable?: boolean;
}
```

示例：

```json
{
  "id": "json.cheatsheet",
  "title": {
    "key": "documents.cheatsheet.title",
    "default": "JSON CheatSheet"
  },
  "format": "markdown",
  "source": {
    "default": "./docs/json.md",
    "localized": {
      "zh-CN": "./docs/json.zh-CN.md"
    }
  },
  "searchable": true
}
```

### 6.3 Table

Table 表示结构化数据源，不是 UI 表格组件。

```ts
interface TableContribution {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  columns: TableColumn[];
  query?: TableQueryCapability;
}
```

示例：

```json
{
  "id": "http.status-codes",
  "title": {
    "key": "tables.httpStatus.title",
    "default": "HTTP Status Codes"
  },
  "columns": [
    {
      "id": "code",
      "title": {
        "key": "tables.httpStatus.columns.code",
        "default": "Code"
      },
      "type": "number",
      "sortable": true
    },
    {
      "id": "name",
      "title": {
        "key": "tables.httpStatus.columns.name",
        "default": "Name"
      },
      "type": "string",
      "searchable": true
    },
    {
      "id": "description",
      "title": {
        "key": "tables.httpStatus.columns.description",
        "default": "Description"
      },
      "type": "string",
      "searchable": true
    }
  ],
  "query": {
    "pagination": true,
    "sorting": true,
    "filtering": true,
    "fullTextSearch": true
  }
}
```

### 6.4 View

View 用于复杂自定义 UI，例如正则测试器、SQL 客户端、流程图编辑器。

原则：

```text
View 不应该直接依赖宿主 React/Vue
View 不应该直接访问 Electron API
View 应该通过标准 bridge / RPC 调用宿主能力
```

示例：

```json
{
  "id": "regex.tester",
  "title": {
    "key": "views.regexTester.title",
    "default": "Regex Tester"
  },
  "type": "webview",
  "entry": "./views/regex-tester/index.html",
  "activationEvents": ["onView:regex.tester"]
}
```

第一版可以先不做复杂 View，只预留协议字段。

---

## 7. Runtime 设计

插件入口：

```ts
export interface ToolboxPlugin {
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(ctx: PluginContext): void | Promise<void>;
}
```

插件 SDK：

```ts
export function definePlugin(plugin: ToolboxPlugin): ToolboxPlugin {
  return plugin;
}
```

示例插件：

```ts
import { definePlugin } from "@tooldeck/sdk";

export default definePlugin({
  activate(ctx) {
    ctx.subscriptions.push(
      ctx.commands.register("json.format", async (input) => {
        const value = JSON.parse(input.text);

        return {
          status: "success",
          blocks: [
            {
              type: "code",
              language: "json",
              text: JSON.stringify(value, null, input.indent ?? 2),
            },
          ],
        };
      }),
    );
  },

  async deactivate() {
    // cleanup
  },
});
```

---

## 8. Lifecycle 设计

插件生命周期：

```text
discover     发现插件 Manifest，不执行插件代码
install      安装插件
enable       启用插件
disable      禁用插件
activate     激活插件代码
deactivate   停用插件代码
dispose      销毁运行环境
uninstall    卸载插件
```

关键规则：

```text
安装插件 ≠ 激活插件
启用插件 ≠ 立即运行插件
Manifest 可被静态扫描
真正调用命令时才 activate
```

懒激活示例：

```text
用户点击 Format JSON
  ↓
触发 onCommand:json.format
  ↓
加载插件入口
  ↓
activate(ctx)
  ↓
执行 json.format
```

插件运行状态建议：

```text
notLoaded
loading
loaded
activating
active
deactivating
inactive
failed
disposed
```

---

## 9. Disposable 机制

插件注册的资源需要可释放。

```ts
export interface Disposable {
  dispose(): void | Promise<void>;
}
```

所有注册 API 返回 Disposable：

```ts
const disposable = ctx.commands.register("json.format", handler);
ctx.subscriptions.push(disposable);
```

停用插件时，宿主自动清理：

```ts
for (const item of ctx.subscriptions) {
  await item.dispose();
}
```

PluginContext：

```ts
interface PluginContext {
  pluginId: string;
  subscriptions: Disposable[];

  commands: CommandRegistry;
  documents: DocumentRegistry;
  tables: TableRegistry;
  storage: PluginStorage;
  logger: PluginLogger;
  events: PluginEventBus;
}
```

---

## 10. Presentation / Content Blocks

命令不要返回 React/Vue 组件，而是返回结构化内容块。

```ts
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "markdown"; text: string }
  | { type: "code"; language?: string; text: string }
  | { type: "json"; value: unknown }
  | { type: "table"; columns: TableColumn[]; rows: Record<string, unknown>[] }
  | { type: "file"; name: string; mimeType?: string; uri: string };

interface CommandResult {
  status: "success" | "error";
  blocks: ContentBlock[];
  metadata?: Record<string, unknown>;
}
```

不同宿主负责不同展示：

```text
Desktop → 渲染成 UI
CLI     → 打印成文本 / 表格 / JSON
API     → 返回 JSON
```

---

## 11. I18n 设计

定义：

```ts
type LocalizedString =
  | string
  | {
      key: string;
      default: string;
    };
```

Manifest 支持：

```json
{
  "defaultLocale": "en",
  "locales": {
    "en": "./locales/en.json",
    "zh-CN": "./locales/zh-CN.json"
  }
}
```

`locales/zh-CN.json`：

```json
{
  "plugin.name": "JSON 工具",
  "plugin.description": "用于格式化、校验和学习 JSON 的工具。",
  "commands.format.title": "格式化 JSON",
  "commands.format.description": "使用自定义缩进格式化 JSON 文本。",
  "schema.format.text.title": "JSON 文本",
  "schema.format.text.description": "输入 JSON 文本。",
  "schema.format.indent.title": "缩进大小",
  "documents.cheatsheet.title": "JSON 速查表"
}
```

规则：

```text
协议字段不翻译：id / commandId / tableId / permission
展示字段可翻译：title / description / label / category
文档按文件本地化
JSON Schema 保持标准，用 x-i18n 提供翻译 key
运行时 context 传入 locale
```

Schema 中推荐：

```json
{
  "type": "string",
  "title": "JSON Text",
  "description": "Input JSON text.",
  "x-i18n": {
    "title": "schema.format.text.title",
    "description": "schema.format.text.description"
  }
}
```

---

## 12. 权限系统设计

第一版只做基础权限声明和记录，先不做完整沙箱。

Manifest 权限示例：

```json
{
  "permissions": [
    {
      "id": "clipboard:write",
      "reason": {
        "key": "permissions.clipboardWrite.reason",
        "default": "Copy command results to the clipboard."
      }
    },
    {
      "id": "storage:plugin",
      "reason": {
        "key": "permissions.storage.reason",
        "default": "Save plugin settings."
      }
    }
  ]
}
```

权限系统原则：

```text
Manifest 声明权限和原因
安装/启用时用户授权
SQLite 持久化授权状态
PluginContext 只提供受控 API
敏感 API 调用走 PermissionManager
默认拒绝未声明/未授权权限
高风险行为后续可写审计日志
插件更新新增权限时需要重新确认
不可信插件不要同进程运行
```

第一版支持的权限可以很少：

```text
storage:plugin
clipboard:read
clipboard:write
fs:read:user-selected
fs:write:user-selected
shell:execute
network:https
```

注意：

```text
权限系统不是沙箱。
同进程 Node 插件几乎不可能真正安全。
如果后续要支持不可信插件，需要独立进程、WASM 或 OS sandbox。
```

---

## 13. 存储设计

按数据类型拆分存储。

推荐：

```text
Core State      → SQLite
App Config      → JSON / Store
Plugin Files    → File System
Secrets         → OS Secure Storage
Renderer Cache  → IndexedDB / localStorage
Analytics       → DuckDB，可选
Sync            → RxDB / PGlite，可选
```

SQLite 存：

```text
插件状态
插件权限
命令历史
执行日志
收藏
索引
Plugin scoped KV
```

JSON / Store 存：

```text
主题
语言
窗口大小
侧边栏状态
API Server 端口
最近工作区
```

文件系统存：

```text
插件包
Markdown 文档
导出文件
图片
PDF
缓存文件
模板
临时文件
```

安全存储存：

```text
API Key
Token
数据库密码
OAuth Refresh Token
SSH 凭据
```

Renderer localStorage / IndexedDB 存：

```text
UI 临时状态
打开的 tab
表格列宽
编辑器草稿
页面缓存
```

---

## 14. Electron 数据库架构

推荐：

```text
Electron + SQLite + Drizzle ORM + better-sqlite3
```

数据流：

```text
Renderer
  ↓ window.tooldeck.commands.run()
Preload
  ↓ ipcRenderer.invoke("commands.run")
Main IPC Handler
  ↓ CommandService
TPP Core
  ↓ PluginManager / CommandRegistry
Storage
  ↓ Drizzle / SQLite
```

原则：

```text
Renderer 不直接访问数据库
Renderer 不直接 import 插件代码
Renderer 不直接拿 Node 权限
数据库只在 Main / Backend 层初始化
CLI/API/Desktop 复用 packages/storage
```

开发时数据库路径：

```ts
const dbPath = app.isPackaged
  ? path.join(app.getPath("userData"), "tooldeck", "tooldeck.sqlite")
  : path.join(process.cwd(), ".data", "dev.sqlite");
```

---

## 15. SQLite Schema 初步建议

可以先设计这些表：

```sql
plugins(
  id text primary key,
  name_json text not null,
  version text not null,
  manifest_path text not null,
  enabled integer not null default 0,
  installed_at integer not null,
  updated_at integer not null
);

plugin_permissions(
  plugin_id text not null,
  permission_id text not null,
  scope_json text,
  status text not null,
  grant_type text not null,
  created_at integer not null,
  updated_at integer not null,
  primary key(plugin_id, permission_id)
);

plugin_kv(
  plugin_id text not null,
  namespace text not null,
  key text not null,
  value_json text,
  updated_at integer not null,
  primary key(plugin_id, namespace, key)
);

command_runs(
  id text primary key,
  command_id text not null,
  plugin_id text not null,
  source text not null,
  status text not null,
  input_json text,
  output_json text,
  error_json text,
  duration_ms integer,
  created_at integer not null
);

favorites(
  id text primary key,
  target_type text not null,
  target_id text not null,
  created_at integer not null
);
```

后续再补：

```text
documents_index
tables_index
audit_logs
plugin_errors
recent_items
tasks
```

---

## 16. 第一阶段实现目标

第一阶段目标：跑通最小闭环。

必须实现：

```text
1. 创建 pnpm workspace MonoRepo
2. 创建 Electron desktop app
3. 创建 CLI app
4. 创建 packages/protocol
5. 创建 packages/core
6. 创建 packages/sdk
7. 创建 packages/host-node
8. 创建 packages/storage
9. 定义 Manifest 类型和 JSON Schema
10. 实现 Manifest 扫描
11. 实现 CommandRegistry
12. 实现 Node 插件 activate/deactivate
13. 实现 ContentBlock CommandResult
14. 实现 SQLite 存储
15. 实现一个 json-tools 示例插件
16. Desktop 可以展示 commands 并调用 json.format
17. CLI 可以调用 json.format
```

MVP 成功标准：

```text
tooldeck desktop 启动后能看到 JSON Format 工具
用户输入 JSON 后能格式化并展示 code block

tooldeck cli run json.format --text '{"a":1}'
能输出格式化后的 JSON

插件 manifest 不激活也能被扫描
真正调用 command 时才 activate 插件
命令执行记录写入 SQLite
```

---

## 17. 不要做的事情

第一版不要做：

```text
不要做插件市场
不要做远程插件安装
不要做完整沙箱
不要做 WASM 插件
不要做 MCP
不要做 OpenAPI 自动生成
不要做复杂权限弹窗
不要做复杂 View 插件
不要做插件热更新
不要做插件依赖解析
不要让插件直接贡献 React/Vue 组件
不要让 Renderer 直接访问数据库
不要让 Renderer 直接执行插件代码
```

---

## 18. 命名规范

项目名：

```text
tooldeck
```

协议名：

```text
Toolbox Plugin Protocol
TPP
```

npm scope：

```text
@tooldeck/protocol
@tooldeck/core
@tooldeck/sdk
@tooldeck/host-node
@tooldeck/storage
@tooldeck/shared
```

命令名：

```text
tooldeck
```

示例命令：

```bash
tooldeck plugin list
tooldeck plugin enable dev.example.json-tools
tooldeck run json.format --text '{"a":1}'
tooldeck doc json.cheatsheet
tooldeck table http.status-codes --search 404
```

---

## 19. 给 AI Agent 的实现要求

实现时请遵守：

```text
1. 优先实现小而清晰的核心，不要过度设计。
2. packages/protocol 不允许依赖 Electron、React、SQLite。
3. packages/core 不允许依赖 Electron UI。
4. Renderer 不允许直接访问数据库。
5. Renderer 不允许直接执行插件代码。
6. 插件能力必须通过 PluginContext 暴露。
7. 命令结果必须返回 Content Blocks，不返回 UI 组件。
8. Manifest 是静态声明，插件运行时是懒激活。
9. 插件注册资源必须返回 Disposable。
10. 所有可展示文本优先支持 LocalizedString。
11. JSON Schema 保持标准，用 x-i18n 和 x-ui 做扩展。
12. 第一版只支持可信本地插件。
13. 权限系统先做声明和记录，不做完整安全沙箱。
14. SQLite 只存核心状态，大文件放文件系统，密钥放系统安全存储。
15. 所有包必须使用 TypeScript。
```

---

## 20. 总结

`tooldeck` 是一个基于 TPP 协议的桌面工具箱项目。

TPP 的核心定义：

```text
TPP 是一套面向工具箱应用的插件协议。
它通过 Manifest 静态声明插件能力，
通过 Contribution Points 描述 commands / documents / tables / views，
通过 Activation Events 实现懒加载，
通过 PluginContext 提供运行时能力，
通过 JSON Schema 描述输入输出，
通过 Content Blocks 解耦 UI 展示，
通过 LocalizedString 支持 I18n，
通过 Permission Model 控制插件能力，
并允许 Desktop / CLI / API 共享同一套插件核心。
```

第一版目标：

```text
先做一个可信插件的本地工具箱核心。
跑通 Desktop + CLI + Command + Document + Table + SQLite 历史记录。
不要一开始做成完整插件生态平台。
```
