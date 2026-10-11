# PROJECT_HANDOFF · AI 协作与跨对话交接

> 本文档是项目状态摘要，不是代码、PR 或验收的替代证据。任何新会话必须重新读取 GitHub 最新 refs、PR 和实际测试记录。产品约束以 `PRODUCT_DESIGN.md` 为准，工程和审批要求以 `AGENTS.md` 为准；用户明确批准只在已批准范围内有效。

## 项目与正式基准

- 项目：`seaforest123/jinbo-review`，金箔非遗微信原生小程序。
- 默认分支：`main`。PR [#2](https://github.com/seaforest123/jinbo-review/pull/2) 已合并，建立正式代码基准；合并 SHA：`9376564a752a93ca97a7a16901c0445545a2a76b`。
- 原始 Codex 分支：`codex/seven-page-optimization`，保留历史，不重置、不强推、不删除。
- [Ruleset Protect main](https://github.com/seaforest123/jinbo-review/rules/24882306) 已启用；要求 PR、禁止强推与删除、要求解决审查讨论；批准数量 0；**目前没有强制 CI status check**。
- PR [#4](https://github.com/seaforest123/jinbo-review/pull/4) 已合并：移除当前树内的 `.claude/settings.local.json` 并加入忽略规则；**旧 Git 历史仍可能被公众访问**。
- PR [#5](https://github.com/seaforest123/jinbo-review/pull/5)、[#6](https://github.com/seaforest123/jinbo-review/pull/6)、[#7](https://github.com/seaforest123/jinbo-review/pull/7) 已合并，分别引入 CI、修复 shallow checkout 和修复旧文件空白格式。
- 本交接文档通过 PR [#3](https://github.com/seaforest123/jinbo-review/pull/3) 提出。协作规范 `docs/GITHUB_WORKFLOW.md` 由 PR [#1](https://github.com/seaforest123/jinbo-review/pull/1) 提出。**PR 状态可随合并改变，不以此段文字代替实时复核。**

## 已验证与未验证

- 2026-10-11 [GitHub Actions run 38149226374](https://github.com/seaforest123/jinbo-review/actions/runs/38149226374) 对整合 HEAD `5d42a7c390a6af80e7844b84945cc916c64c7f26` 运行成功：根目录 `tests/` 主项目测试 259/259 通过；`npm run audit:assets` 通过（package 1,577,635 bytes；videos 284,362 bytes）；`git diff --check` 通过。
- 该证据属于自动化检查，不是微信工具或实际设备验收。**微信开发者工具、iOS/Android 真机、CloudBase 实际部署和运行仍未验证。**文化素材专业审核与正式发布亦不可推定已完成。
- PR #2 按用户明确批准，以“自动化测试合格代码基准”口径合入 `main`；不代表全部 P0/P1 手工验收已通过。

## 待办与风险

1. 微信开发者工具核查 10 个已注册页面及四项 Tab，重点实测五任务闭环和 `session.grid` 的跨步骤传递；记录模拟器型号、操作、截图/录屏。
2. 真机、CloudBase 与内容专业审核保持待办；涉及凭据的操作不要写入仓库。
3. 公开仓库旧历史仍包含本地 Claude permissions 文件；当前静态筛查未匹配常见令牌模式，但不代表完整秘密历史审计。
4. 持续确认 GitHub Ruleset 是否生效；在 CI 稳定且符合审批后，可评估强制状态检查。
5. 若 `docs/GITHUB_WORKFLOW.md` 尚未进入 `main`，核查 PR #1 并按审查结果处理。

## 每次新对话启动

1. 读取最新 `main` 提交、全部 open PR、分支、Ruleset、CI；不可只看此交接文档。
2. 完整阅读 `PRODUCT_DESIGN.md` 和 `AGENTS.md`，再读本文件及已合并的 `docs/GITHUB_WORKFLOW.md`；未合并文件需注明所在 PR。
3. 确认目标模块、实现/审查方、允许修改文件、批准范围；多文件改动遵守 `AGENTS.md` 的先分析与等待确认要求。
4. 从最新 `main` 新建单任务分支，通过 PR 提交代码和交接记录；不直接写入受保护 `main`。
5. 报告准确命令、日志、测试结论、未验证项和遗留问题。未经实际执行不得写“通过”。

## 结束任务交接模板

```text
更新时间（含时区）：
任务与用户已明确批准范围：
实现方 / 审查方：
main 基准 SHA / 任务分支 / 提交 SHA / PR：
允许修改文件 / 实际修改文件：
本次实际完成：
运行过的测试（命令、环境、日志链接、结果）：
未执行的验证：
阻塞 / 风险 / 下一步接手建议：
```

交接文件与业务修改在同一任务分支/PR 或独立文档 PR 中更新。合并或关闭 PR 后应及时刷新状态；不复制长篇聊天记录，不写入 API token、Cookie、本地专用权限、用户私人信息或环境凭据。
