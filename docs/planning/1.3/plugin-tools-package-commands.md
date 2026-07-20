# Plugin Tools Package Commands

> **Status:** Implemented in Tooldeck 1.3. `tooldeck-plugin pack` and
> `tooldeck-plugin dist` use the final public package name `@tooldeck/plugin-package`; the
> plural name below is retained as historical planning terminology.

本文定义 Tooldeck 1.3 中 `@tooldeck/plugin-tools` 新增打包命令的目标和边界。

## 背景

1.2 中 `@tooldeck/plugin-tools` 已经提供：

```text
tooldeck-plugin generate
tooldeck-plugin check
tooldeck-plugin build
tooldeck-plugin inspect
```

1.3 在此基础上补齐插件作者产出本地安装包的能力。

## 命令

P0 新增：

```bash
tooldeck-plugin pack
tooldeck-plugin dist
```

## `tooldeck-plugin pack`

`pack` 面向已经完成构建的插件项目。

行为：

- 读取 `manifest.json`。
- 运行等价于 `tooldeck-plugin check --built` 的检查。
- 不运行插件项目测试。
- 不自动执行 build。
- 默认生成 `<plugin-id>-<version>.tdplugin`。
- 支持通过 `--output <file>` 覆盖输出文件路径。
- 写入 root `tooldeck-package.json`。
- 调用 `@tooldeck/plugin-packages` 完成包写入和校验。

`pack` 失败条件：

- manifest 无效。
- generated command types 不同步。
- built runtime entry 缺失。
- built runtime entry 形态检查失败。
- 包内将包含 `node_modules`。
- 包文件列表不合法。
- `.tdplugin` 写入失败。

## `tooldeck-plugin dist`

`dist` 面向希望一条命令产出安装包的插件作者。

行为：

```text
generate
  -> check
  -> build
  -> check --built
  -> pack
```

`dist` 可以复用现有 `buildPluginProject` 流程，再调用 `pack` 能力。`dist` 也不自动运行插件项目测试。

## 输出命名

默认输出：

```text
<plugin-id>-<version>.tdplugin
```

示例：

```text
dev.example.my-plugin-0.1.0.tdplugin
```

P0 不从 `package.json.name` 或 manifest display name 生成文件名，避免本地化名称、空格和 npm package name 与 plugin id 混淆。

P0 支持显式覆盖输出文件路径：

```bash
tooldeck-plugin pack --output ./release/my-plugin.tdplugin
tooldeck-plugin dist --output ./release/my-plugin.tdplugin
```

`--output` 只影响写入的文件路径，不修改包内 metadata，也不改变 `manifest.json` 或 `tooldeck-package.json` 的身份字段。

P0 不支持 `{name}` / `{version}` 等文件名占位符模板。原因：

- package identity 来自 manifest 和 package metadata，不来自文件名。
- `{name}` 容易混淆 plugin id、manifest display name 和 `package.json.name`。
- manifest display name 可本地化，不适合作为稳定产物文件名来源。

## 测试边界

插件行为测试由插件作者自己维护。1.2 已提供 `@tooldeck/plugin-tools/testing` helper，1.3 的 `pack` 和 `dist` 不自动运行测试。

原因：

- 测试框架属于插件项目选择。
- packaging 命令应关注产物可安装性，而不是业务逻辑正确性。
- 自动运行测试会让 pack 命令变慢，并引入项目级配置差异。

## 非目标

`tooldeck-plugin pack` 和 `dist` 不做：

- 安装插件。
- 发布到 marketplace。
- 上传远程 registry。
- 包签名。
- 自动运行插件 tests。
- 从 runtime code 反推 manifest。
- 修改 manifest。
- 文件名占位符模板。

## 验收标准

- `tooldeck-plugin pack` 可以为已构建插件生成 `.tdplugin`。
- `tooldeck-plugin pack --output <file>` 可以覆盖输出文件路径，且不修改包内 metadata。
- `tooldeck-plugin pack` 在 `check --built` 失败时失败。
- `tooldeck-plugin dist` 可以完成构建并生成 `.tdplugin`。
- 输出包可以被 `@tooldeck/plugin-packages` 读取和校验。
- 包内包含 root `manifest.json` 和 root `tooldeck-package.json`。
- 包内不包含 `node_modules`。
