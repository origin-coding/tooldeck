# GitHub Issue Conventions

本文定义 Tooldeck 使用 GitHub Issues 记录内部规划、决策、行为基线和实施工作的统一约定。
Issue templates 应当实现这些约定，但模板不能替代这里定义的生命周期和关系规则。

## Record Boundary

新建和仍在推进的内部治理记录以 GitHub Issues 为事实来源：

```text
Planning
RFC and ADR
Behavior baseline
Implementation tracking
Migration and release coordination
```

仓库内的 `docs/` 面向第三方用户、插件作者和公开协议契约。既有 `docs/planning/` 与
`docs/architecture/decisions/` 在迁移完成前仍是历史来源，但不再为同一项新工作同时创建
Issue 记录和重复文档。

当前必须遵守的约束不能只存在于远程 Issue。类型、Schema、测试、构建检查和 `AGENTS.md`
应当表达代码当前必须满足的规则；Issue 负责记录背景、讨论、原因和演进历史。

## Label Model

Labels 使用互相正交的命名空间：

```text
type:*       Issue 的记录或工作类型
decision:*   决策生命周期
scope:*      主要影响的 package、应用或仓库边界
```

规则：

- 每条 Issue 必须恰好有一个 `type:*`。
- `type:decision` 必须恰好有一个 `decision:*`；其他类型不得使用 `decision:*`。
- 实施、bug、feature 和 baseline 应至少有一个 `scope:*`。
- Planning 和 decision 可以有多个 scope；普通 Issue 尽量不超过两个。
- 仓库级工作优先使用 `scope:workspace`，不要为每个 package 都添加 scope。
- 不创建无命名空间 labels，也不恢复 GitHub 默认的 `bug`、`enhancement`、
  `documentation` 等 labels。
- 不使用版本 labels；目标版本由 Milestone 表达。
- 不使用 `status:blocked`；阻塞关系由 GitHub 原生 dependencies 表达。
- 新增 label 命名空间或值之前，先更新本约定并说明无法使用现有 labels 的原因。

颜色和英文描述由 GitHub label registry 保存，不在本文重复维护。

## Type Labels

| Label           | 用途                                             |
| --------------- | ------------------------------------------------ |
| `type:planning` | 版本或大型 initiative 的规划、决策门和工作拆分   |
| `type:decision` | 从 RFC 提案到 ADR 或拒绝结论的完整决策记录       |
| `type:baseline` | 绑定特定 revision 的行为、构件或性能证据         |
| `type:bug`      | 实际行为违反已定义或合理预期                     |
| `type:feature`  | 新增或增强用户可观察能力，包括功能请求           |
| `type:task`     | 重构、维护、依赖、构建、测试、迁移或其他工程工作 |
| `type:docs`     | 主要交付物是第三方文档                           |

不单独创建 `enhancement` 或 `feature request`。分类方式为：

```text
预期行为没有正确实现                 -> type:bug
用户会观察到新的或增强的能力         -> type:feature
只改变内部实现、构建、依赖或维护方式 -> type:task
```

功能请求在被接受和排期前保持无 Milestone；加入 Milestone 或成为 Planning 的 sub-issue
表示它已经进入目标版本计划。

## Decision Lifecycle

Decision Issue 的稳定类型始终是 `type:decision`。RFC 和 ADR 是同一条 Issue 的不同生命
周期阶段，不复制为两条记录。

| Label                 | GitHub state | 含义                          |
| --------------------- | ------------ | ----------------------------- |
| `decision:draft`      | Open         | 正在整理，尚未进入正式审查    |
| `decision:review`     | Open         | 提案完整，等待审查和结论      |
| `decision:accepted`   | Closed       | 已接受，当前 Issue 成为 ADR   |
| `decision:rejected`   | Closed       | 已评估并明确不采用            |
| `decision:withdrawn`  | Closed       | 提案被撤回或问题已经失效      |
| `decision:superseded` | Closed       | 曾被接受，但已由新的 ADR 替代 |

生命周期：

```text
decision:draft
  -> decision:review
       -> decision:accepted
       -> decision:rejected
       -> decision:withdrawn

decision:accepted
  -> decision:superseded
```

创建和审查期间，标题使用：

```text
[RFC] Short decision title
```

接受后，在关闭前完成：

1. 将正文整理为可以独立阅读的最终版本。
2. 填写最终 Decision、Consequences 和被否决方案。
3. 记录 decision date、适用版本、effective PR 或 commit。
4. 将标题改为 `[ADR] Short decision title`。
5. 将 lifecycle label 改为 `decision:accepted`。
6. 添加简短的接受评论并关闭 Issue。

接受后的正文语义冻结，只允许修正拼写、格式或失效链接。改变语义必须新建 RFC；新决策接受
后，将旧 ADR 改为 `decision:superseded`，并在两条 Issue 中记录 `Supersedes` / `Superseded
by` 关系。不要通过重新打开旧 ADR 改写历史。

对于迁移既有 ADR 或补录已经实施且仍有效的决策，可以直接创建最终决策记录，但仍应短暂保持
Open 以完成核对，再标记 `decision:accepted` 并关闭。

## Scope Labels

Scope 表示主要代码所有权或应用边界，并与 Conventional Commit scope 保持一致。

| Label                  | 边界                                 |
| ---------------------- | ------------------------------------ |
| `scope:protocol`       | TPP 数据契约和公开协议规范           |
| `scope:sdk-node`       | 公开 Node 插件作者 SDK               |
| `scope:plugin-package` | 公开 `.tdplugin` 格式实现            |
| `scope:plugin-tools`   | 公开插件作者工具和测试辅助能力       |
| `scope:vite-plugin`    | 公开 Node 插件 Vite 集成             |
| `scope:create-plugin`  | 外部插件项目生成器                   |
| `scope:runtime`        | 私有 Node runtime 实现               |
| `scope:application`    | 私有 Node application service        |
| `scope:cli`            | Tooldeck CLI 应用                    |
| `scope:desktop`        | Electron Desktop 应用                |
| `scope:apps`           | CLI 与 Desktop 共同的应用边界        |
| `scope:plugins`        | 内置插件和 canonical plugin examples |
| `scope:workspace`      | Workspace、依赖、跨包构建和仓库工具  |
| `scope:release`        | 发布准备、构件、发布和验收           |

`scope:apps` 只用于真正属于 CLI/Desktop 共同边界的工作，不是同时添加 `scope:cli` 与
`scope:desktop` 的默认缩写。Storage 属于 application；Effect、errors 和 architecture 是主题
而不是所有权边界，当前不建立对应 scope。

## Milestones

- 已排期的 planning、decision、baseline、implementation、bug 和 feature 必须加入目标版本
  Milestone。
- 当前 Tooldeck 1.4 架构和迁移工作使用 `1.4.0` Milestone。
- 尚未被接受和排期的 feature request 保持无 Milestone。
- 在某个版本周期内被 rejected 或 withdrawn 的 decision 保留当时的 Milestone，表示评估背景。
- Superseded ADR 保留原 Milestone；替代它的新 decision 使用自己的目标版本。
- Milestone 表示目标版本，不表示 Issue 当前优先级或执行状态。

## Hierarchy and Dependencies

使用 GitHub 原生关系作为结构化事实来源：

```text
Planning / initiative -> parent and sub-issues
Execution ordering    -> blocked-by and blocking dependencies
Target release        -> Milestone
```

正文中的列表、链接和 dependency diagram 可以解释关系，但不能成为唯一记录。Planning Issue
关闭前必须把实施工作拆成可以独立验收的 sub-issues，并维护最终索引。

Planning Issue 表示“规划工作”，不是整个版本的执行状态。以下条件满足后可以关闭：

- 目标、非目标和兼容边界已经明确；
- 必需 RFC 已建立，当前可决定的 ADR 已形成；
- 实施工作已拆分为 sub-issues；
- Milestone 和 native dependencies 已设置；
- 正文包含最终决策与实施索引。

## Splitting Issues

拆分既有 Issue 时：

1. 保留现有 Issue 承担占原始内容主导部分的 scope，不为了对称而废弃原编号。
2. 先创建抽出的 sibling Issue，记录 `Extracted from #NN`。
3. 新旧 Issue 添加 reciprocal links，并使用相同的 parent Planning Issue。
4. 分别应用正确的 `type:*`、`scope:*` 和 Milestone。
5. 把 blocked-by/blocking 关系移动到真正拥有前置条件的 Issue。
6. 编辑原 Issue 的标题、Objective、Scope、Non-goals 和 Acceptance criteria，删除已抽出的内容。
7. 在原 Issue 添加 split comment，说明边界和新 Issue 编号。
8. 更新 parent Planning Issue 的 sub-issues 和最终索引。

拆分后不能让两个 Issue 同时声称拥有相同的主要交付物或验收条件。

## Issue Body and Comments

Issue body 始终表示当前完整提案、最终决策或可执行任务。读者不应通过阅读全部评论才能确定
当前有效内容。

Comments 用于：

- 仓库调研和实验结果；
- benchmark 和 failure injection evidence；
- 方案质疑与被否决原因；
- Session 或会议记录；
- 正文发生重要更新的说明；
- 接受、拒绝、撤回、拆分或 supersede 的 timeline record。

Decision 接受后以冻结的正文为 ADR。Implementation Issue 不重复论证已接受的架构方案，只链接
governing decision，并记录实施证据和偏差。

## Closing Rules

- `type:planning`：规划完成、关系和索引建立后关闭，不等待所有实施完成。
- `type:decision`：只有设置 accepted、rejected 或 withdrawn 后才关闭；superseded 保持关闭。
- `type:baseline`：证据绑定 revision、复现方式完整并完成冻结后关闭。
- `type:bug`、`type:feature`、`type:task`、`type:docs`：验收标准满足并记录验证结果后关闭。
- 不计划实施的非 decision Issue 使用 GitHub `not planned` close reason，并在评论中说明原因。

## Creation and Review Checklist

创建或修改 Issue 前检查：

- [ ] 已读取本约定和适用模板。
- [ ] 已搜索重复或已经 superseded 的 Issue。
- [ ] 恰好设置一个 `type:*`。
- [ ] Decision 恰好设置一个 `decision:*`。
- [ ] 使用已有且正确的 `scope:*`。
- [ ] 已排期工作设置目标 Milestone。
- [ ] Parent/sub-issue 使用原生关系。
- [ ] Blocked-by/blocking 使用原生 dependencies。
- [ ] 正文包含明确的目标、范围、非目标和关闭/验收条件。
- [ ] 没有把同一份新记录同时复制到 GitHub Issue 和内部 docs。

关闭或接受前检查：

- [ ] 正文已经反映最终有效内容。
- [ ] 验证或决策证据已经记录。
- [ ] PR、commit、相关 Issue 和替代关系已经链接。
- [ ] Parent Planning 索引和 native relationships 已更新。
- [ ] Label、Milestone 和 GitHub close reason 与最终状态一致。
