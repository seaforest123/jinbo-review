# Gold Foil Project Directory Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前错误工作目录中的金箔非遗项目成果无损复制到 `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目`，并提供可让新 Codex 任务直接接续的结构化上下文。

**Architecture:** 迁移采用“原目录只读保留、新目录分类复制”的方式。交付材料、原始输入、制作脚本和迁移说明分目录存放；使用文件大小与 SHA-256 清单核验复制完整性。

**Tech Stack:** Windows PowerShell、Markdown、SHA-256、Word `.docx`

## Global Constraints

- 不删除、不移动、不覆盖当前目录中的原始文件。
- 不复制当前错误项目中与金箔非遗无关的小程序代码、图片、视频或配置。
- 最新有效产品需求以 PRD V0.3 为准，V0.1 和原始 V0.2 仅作版本追溯。
- 未经专业老师确认的身份、级别、工艺路线与历史信息继续标记为待核实。
- 制箔与贴箔保持并列候选，首次专业访谈后再锁定主线。

---

### Task 1: Inventory Current Deliverables

**Files:**
- Read: `D:\WeChatProjects\miniprogram-1\docs\gold-foil-heritage\**`
- Read: `D:\WeChatProjects\miniprogram-1\scripts\*gold*`
- Read: `C:\Users\Andrew\Downloads\金箔非遗小程序产品需求文档PRD-V0_2.docx`
- Read: `C:\Users\Andrew\Downloads\首次专业访谈准备清单.docx`

- [ ] **Step 1: Enumerate gold-foil deliverables and record file sizes**

Run PowerShell `Get-ChildItem` over the four source sets above.

- [ ] **Step 2: Exclude unrelated source-code assets**

Confirm that `pages`, `components`, `cloudfunctions`, `images`, `videos`, and root mini-program configuration are not selected for migration.

### Task 2: Create Handoff Context

**Files:**
- Create: `docs/gold-foil-heritage/migration/项目迁移交接说明_V1.0_20260719.md`
- Create: `docs/gold-foil-heritage/migration/新项目任务接续提示词_20260719.txt`

- [ ] **Step 1: Record accepted project decisions**

Include competition route, target users, product positioning, three parallel workstreams, four roles, version baseline, evidence strategy, privacy approach, and unresolved professional questions.

- [ ] **Step 2: Record continuation instructions**

Explicitly tell the new task to read the handoff first, treat PRD V0.3 as the baseline, avoid inheriting unrelated code from the old directory, and begin from professional-interview scheduling.

### Task 3: Copy Into New Project Structure

**Files:**
- Create directory: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\00_项目交接与总览`
- Create directory: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\01_项目简报与产品需求`
- Create directory: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\02_团队任务与项目启动`
- Create directory: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\03_首次专业访谈`
- Create directory: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\90_制作与校验脚本`

- [ ] **Step 1: Create destination directories**

Use `New-Item -ItemType Directory -Force` only for the exact paths above.

- [ ] **Step 2: Copy classified files without deleting sources**

Use `Copy-Item -LiteralPath` for every inventoried file. Preserve the interview-pack subdirectory as a unit.

- [ ] **Step 3: Generate destination README and checksum manifest**

Create a root `README_项目文件导航.md` and `00_项目交接与总览\迁移文件清单_SHA256.csv`.

### Task 4: Verify Migration

**Files:**
- Verify: `C:\Users\Andrew\Documents\金箔非遗数字体验与活化传播项目\**`

- [ ] **Step 1: Compare source and destination file sizes**

Every copied source file must have one destination file with the same byte length.

- [ ] **Step 2: Verify SHA-256 manifest**

Recompute SHA-256 for every migrated file and confirm each value matches the manifest.

- [ ] **Step 3: Verify continuation entry points**

Confirm the destination contains `README_项目文件导航.md`, the handoff document, the continuation prompt, PRD V0.3, the four-role seven-week table, the Week 1 kickoff pack, and all ten interview-pack Word documents.
