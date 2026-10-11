# GitHub 协作与分支规范

本仓库以 GitHub `main` 作为**经过验收的集成基准**，不以长期存在的单个开发分支储存所有开发历史；每次变更由 Git commit 保留记录。产品设计及审批约束以 `PRODUCT_DESIGN.md` 与 `AGENTS.md` 为准；多文件改动须履行其事先确认流程。

## 分支约定
- `main`：仅存放经过评审与验证、已合并的代码；默认不直接提交或强推。
- `codex/<task>`、`claude/<task>`、`chatgpt/<task>`：各自从最新 `main` 建立的**任务分支**，开发完成后通过 Pull Request 合并，必要时可删除远程任务分支。
- 一项任务原则上一个分支；多人/多 AI 不同时写同一分支。重要开发前先同步 `main`，不要在未保存的工作区直接切换或拉取。

## 开发与合并
1. 开工前先检查 `git status`，本地未提交改动先提交或安全暂存。
2. 执行 `git fetch origin`，在 `main` 上执行 `git pull --ff-only origin main`；从最新 `main` 建立任务分支。
3. 小步提交并推送任务分支，PR 写明目的、改动范围、测试结果和风险。
4. 在 PR 中检查差异、运行项目适用的测试，再合并到 `main`。不使用 `git push --force` 覆盖协作分支。
5. 合并后本地同步 `main`。遇到冲突时人工核对，不以强制覆盖代替冲突解决。

## 仓库基准引入的过渡阶段（2026-10-11 实查）
- `main` 当前为初始代码基准（HEAD `4dc7dd33d0b8ba4955c185dacd0354bd7c3e696c`），**尚不包含完整小程序**；从 `main` 开始正式功能开发前须重新确认 PR #2 是否已合并。
- `codex/seven-page-optimization`（HEAD `8ac7433f80656ba6acb3b5ca09424a9638d5fbb6`）保留原始 Codex 历史；`integration/codex-baseline-20261011`（HEAD `3f668b9d501d933f2458cfa24945e63c50fef1b1`）已用双父提交连接此前不相关的历史，PR #2 为待验收草稿，不能视为已完成合并。
- [PR #4](https://github.com/seaforest123/jinbo-review/pull/4) 提议排除误跟踪的 `.claude/settings.local.json`；应在合入正式基准前审查该安全修复。PR #3（交接文档）和本 PR #1（协作规范）同样未进入 main。
- **过渡阶段的任务可以基于整合分支提出审查 PR，但不得假装其已经进入 main。** 正式基准确认后，新任务统一从最新 main 建立分支。严禁强推、重置、删除 Codex 原分支。
- 2026-10-11 GitHub API 返回 `main` `protected=false`；branch protection / ruleset 读取受权限或仓库功能限制。本文档不是保护规则；GitHub 上的真实限制须另行核验。

## 建议的 GitHub 保护规则
在 Settings → Rules → Rulesets 为 `main` 创建规则：要求 Pull Request 后才能合并、阻止强推和删除；待持续集成测试配置可靠后，再要求对应状态检查通过。管理员绕过权限需单独审视。
