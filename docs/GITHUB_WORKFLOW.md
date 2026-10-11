# GitHub 协作与分支规范

本仓库以 GitHub `main` 作为已合并的正式代码基准，以 PR 和 Git 提交记录跟踪开发及交接；**已合并不等于微信开发者工具、真机或 CloudBase 已验收**。

本文件是 GitHub 协作操作规范，不能覆盖 `PRODUCT_DESIGN.md`（产品、视觉、需求）和 `AGENTS.md`（工程角色、事前审批、测试和验收）的现行约束。用户对具体范围的最新明确批准优先，仅在该范围有效。

## 分支与权限

- `main`：正式基准，仅通过 PR 提交，不直接推送、强推或删除。
- `chatgpt/<task>`、`claude/<task>`、`codex/<task>`：分别为每个 AI 建立单任务分支，从最新 `main` 创建。一项任务原则上一个分支；不同 AI 不同时修改同一工作区或分支上的同一文件。
- 特殊整合分支 `integration/codex-baseline-20261011` 用于历史迁移，PR #2 已正式合入 main；**后续正常开发不继续把该整合分支当默认基准**。
- `codex/seven-page-optimization` 是原始开发历史，禁止删除、强推、重置；旧 Git 提交可追溯。
- [Protect main Ruleset](https://github.com/seaforest123/jinbo-review/rules/24882306) 已 Active，目标为默认分支，要求 PR、禁止删除与强推、要求解决审查讨论。Required approvals 为 0；尚未强制 CI checks。新对话需实时核验，不能假定规则永不变化。

## 标准流程

1. 先读取远程 `main`、所有相关 PR、任务分支和状态；本地确认 `git status`，保留其他 AI 的未交接改动。先完整阅读 `PRODUCT_DESIGN.md` 和 `AGENTS.md`。
2. 对涉及多文件或页面的任务，按 `AGENTS.md` 分析现状、拟改及不改文件，等用户明确确认后开始。不得自行新增功能、改产品布局、接口或依赖。
3. 开发前 `git fetch origin`，同步本地 `main`（`git pull --ff-only origin main`），再创建任务分支。每个提交保持小范围、可追溯。
4. 运行主项目测试与资源审计（参照 `AGENTS.md`）；检查变更 `git diff --check`，依据实际设备验收记录未验证项。严禁把历史基线数字冒充本次运行结果。
5. 通过 PR 提交，写明任务、范围、准确测试结果、风险及审批证据；确认 CI 运行状态，审查通过后再合并。若项目要求人工验收但未完成，只能在用户明确批准验收口径时继续，且必须标记未验证。
6. 每次完成任务须同步更新 `docs/PROJECT_HANDOFF.md`（同任务 PR 或独立文档 PR），记录 commit SHA、PR、检查证据、未完成工作、下一接手事项。若文档版本与 GitHub 实时状态不符，以远程 refs/PR 为准并修正文档。
7. 合并后本地重新同步 `main`。严禁 `git push --force`，不覆盖未交接工作区；遇冲突逐文件审查，不采取强制覆盖。

## CI 和主分支保护

- 现有 `.github/workflows/baseline-validation.yml` 运行根目录 `tests/` 的 Node.js 测试、`npm run audit:assets` 和差异格式检查。
- 应当检查每一个待合并 PR 的最新 GitHub Actions 运行结果。CI 成功不能替代微信开发者工具、iOS/Android 真机、CloudBase 或专业内容审核。
- 在现有 CI 持续稳定后，可由仓库管理员审查后将对应 status check 加入 Ruleset 必选检查，避免将错误或缺失的检查锁死主分支。
- 本地特殊权限文件、Token、Cookie 和密钥不得进入仓库或交接文档。公开历史中的旧文件不能仅靠新提交删除来消除泄露风险。

## 交接文档入口

- `PRODUCT_DESIGN.md`：产品与视觉事实来源。
- `AGENTS.md`：项目工程协作与审批的约束。
- `docs/PROJECT_HANDOFF.md`：跨对话最新工作状态摘要，接手时必须核对实时 GitHub。
- 本文件：GitHub 分支和 PR 的标准操作规程。
