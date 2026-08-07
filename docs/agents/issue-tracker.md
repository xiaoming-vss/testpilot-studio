# Issue 跟踪器：GitHub

本仓库的问题和 PRD 均记录在 GitHub Issues 中。所有操作使用 `gh` CLI 完成。

## 操作约定

- **创建 Issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 Issue**：`gh issue view <编号> --comments`，使用 `jq` 过滤评论，并同时获取标签。
- **列出 Issues**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，并根据需要添加 `--label` 和 `--state` 过滤条件。
- **评论 Issue**：`gh issue comment <编号> --body "..."`
- **添加或移除标签**：`gh issue edit <编号> --add-label "..."` / `--remove-label "..."`
- **关闭 Issue**：`gh issue close <编号> --comment "..."`

仓库信息从 `git remote -v` 推断；在仓库克隆目录中运行时，`gh` 会自动完成这一操作。

## 是否将 Pull Request 纳入 triage

**将 PR 作为请求入口：否。** _（如果本仓库将外部 PR 视为功能请求，可改为“是”；`/triage` 会读取此配置。）_

设为“是”后，PR 将使用与 Issue 相同的标签和状态，并通过对应的 `gh pr` 命令操作：

- **读取 PR**：使用 `gh pr view <编号> --comments` 查看信息，并使用 `gh pr diff <编号>` 查看差异。
- **列出待 triage 的外部 PR**：执行 `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`，仅保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的记录，排除 `OWNER`、`MEMBER` 和 `COLLABORATOR`。
- **评论、添加标签或关闭**：使用 `gh pr comment`、`gh pr edit --add-label`、`gh pr edit --remove-label` 和 `gh pr close`。

GitHub 的 Issue 和 PR 共用同一个编号空间，因此 `#42` 可能是 Issue，也可能是 PR。先执行 `gh pr view 42`，失败后再尝试 `gh issue view 42`。

## 当技能要求“发布到 issue tracker”时

创建一个 GitHub Issue。

## 当技能要求“获取相关 ticket”时

执行 `gh issue view <编号> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。一个 **map** 对应一个主 Issue，其 **child ticket** 对应子 Issue。

- **Map**：一个带有 `wayfinder:map` 标签的 Issue，正文包含 Notes、Decisions-so-far 和 Fog。使用 `gh issue create --label wayfinder:map` 创建。
- **Child ticket**：通过 GitHub 子 Issue API（使用 `gh api` 调用 sub-issues endpoint）关联到 map。当仓库未启用子 Issue 时，将 child 添加到 map 正文的任务列表中，并在 child 正文顶部写入 `Part of #<map编号>`。标签格式为 `wayfinder:<类型>`，类型包括 `research`、`prototype`、`grilling` 和 `task`。Ticket 被认领后，应分配给负责推进的开发者。
- **阻塞关系**：优先使用 GitHub 原生 Issue dependencies，作为规范且在 UI 中可见的阻塞关系。通过 `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` 添加关系。其中 `<blocker-db-id>` 必须是阻塞 Issue 的数字型数据库 ID，可通过 `gh api repos/<owner>/<repo>/issues/<编号> --jq .id` 获取；不能使用 `#编号` 或 `node_id`。GitHub 通过 `issue_dependencies_summary.blocked_by` 返回尚未关闭的阻塞项数量，该字段是实时放行依据。当原生依赖不可用时，在 child 正文顶部添加 `Blocked by: #<编号>, #<编号>`。只有全部阻塞 Issue 均已关闭，ticket 才视为解除阻塞。
- **查询可执行 ticket**：列出 map 下所有未关闭的 child，排除仍有未关闭阻塞项或已经有 assignee 的 ticket；按照 map 中的顺序选择第一个符合条件的 ticket。
- **认领**：执行 `gh issue edit <编号> --add-assignee @me`。这是会话中的第一次写操作。
- **完成**：先执行 `gh issue comment <编号> --body "<处理结果>"`，然后执行 `gh issue close <编号>`，最后向 map 的 Decisions-so-far 追加上下文指针（gist 及其链接）。
