# 候选内测学习闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立档案学习、三步骤体验、学习报告、本地收藏和进度回看的候选内测闭环。

**Architecture:** 新增版本化本地学习仓储，隔离于既有匿名埋点。体验控制器接收可选且不阻断的学习会话适配器；页面只通过仓储读取报告、进度和收藏。CloudBase 既有资源与埋点契约不变。

**Tech Stack:** 微信小程序 JavaScript/WXML/WXSS、CommonJS、Node 内置测试运行器、微信本地存储。

## Global Constraints

- 仅允许配置内两条候选路线及其三个步骤。
- 仅保存本地会话标识、路线、时间、状态、用时、提示数和重试数。
- 不保存 OpenID、UnionID、手机号、档案、设备标识、位置或自由文本。
- 不改变 `behavior_events`、匿名埋点、CloudBase 集合、云函数、权限、HTTP 入口或依赖。
- 任何读写失败或损坏数据均回退为空状态，不能阻断体验。
- 所有文案保持候选内测边界，不暗示专业确认或公开发布。

## File Structure

- 创建 `miniprogram/services/learning-repository.js`：版本化、校验后的本地会话、报告、进度和收藏。
- 创建 `miniprogram/services/wx-learning-storage.js`：`wx` 异步存储适配器。
- 修改 `miniprogram/domain/experience-controller.js`：记录非阻断学习会话。
- 修改 `miniprogram/pages/experience/index.js`：创建学习会话，将本地报告引用传到结果页。
- 修改 `miniprogram/pages/archive/*`、`result/*`、`activity/*`；创建 `miniprogram/pages/progress/*`。
- 修改 `miniprogram/app.json`；创建/修改对应服务、领域和页面测试。

### Task 1: 本地学习仓储

**Files:** 创建 `miniprogram/services/learning-repository.js`；创建 `tests/services/learning-repository.test.js`。

**Interface:** `createLearningRepository({ routes, storage, now, idFactory })` 返回异步 `startLearningSession(routeId)`、`recordStepOutcome(sessionId, stepId, outcome)`、`completeLearningSession(sessionId)`、`exitLearningSession(sessionId)`、`listSessionReports()`、`getRouteProgress(routeId)`、`toggleFavorite(itemId)`、`listFavorites()`。

- [ ] 写失败测试：完成三步骤后报告状态为 `completed`、有三个步骤且路线完成数为 1；损坏或不可用存储返回空报告和空收藏。
- [ ] 运行 `node --test tests/services/learning-repository.test.js`，确认模块缺失导致失败。
- [ ] 实现存储键 `candidate_learning_v1`：读取无效数据返回 `{ version: 1, sessions: [], favorites: [] }`；只接受配置内路线和步骤；完成/退出报告记录时间、用时与各步骤计数；保存异常吞掉。
- [ ] 再运行该测试，确认完成、退出、收藏、校验和恢复全部通过。
- [ ] 提交：`git add miniprogram/services/learning-repository.js tests/services/learning-repository.test.js`，`git commit -m "feat: add local learning repository"`。

### Task 2: 体验控制器集成

**Files:** 修改 `miniprogram/domain/experience-controller.js`、`tests/domain/experience-controller.test.js`。

**Interface:** 可选 `learningSession` 提供 `start(routeId)`、`recordStep(stepId, outcome)`、`complete()`、`exit()`；`getView()` 成功后增加 `learningReport`。

- [ ] 写失败测试：开始时调用 `start`，每个步骤完成时记录 `{ hintCount, retryCount }`，完成后 `getView().learningReport.reportId` 存在；异步失败不改变既有体验状态。
- [ ] 运行 `node --test tests/domain/experience-controller.test.js`，确认新增断言失败。
- [ ] 增加 `safelyRecord(operation)`，捕获同步和 Promise 异常；开始、步骤完成、完成和退出调用学习会话，但绝不等待它来推进状态机或既有埋点。
- [ ] 重跑控制器测试并提交：`git commit -m "feat: record local learning sessions in experience"`。

### Task 3: 微信存储与结果交接

**Files:** 创建 `miniprogram/services/wx-learning-storage.js`；修改 `miniprogram/pages/experience/index.js`、`tests/page-shell.test.js`。

- [ ] 写失败测试：完成体验跳转 URL 仅包含 `routeId` 与本地 `reportId`，不得出现匿名标识、身份字段、用时或报告 JSON。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认该断言失败。
- [ ] 实现 `createWxLearningStorage(wxApi)`，用 `wx.getStorage` 和 `wx.setStorage` 返回异步 `get`/`set`；体验页构造仓储及会话适配器，结果页只收到本地引用。
- [ ] 重跑页面测试并提交：`git commit -m "feat: pass local learning report to result"`。

### Task 4: 档案、报告、进度与活动页面

**Files:** 修改 `miniprogram/pages/archive/*`、`result/*`、`activity/*`、`miniprogram/app.json`、`tests/page-shell.test.js`；创建 `miniprogram/pages/progress/index.js`、`.json`、`.wxml`、`.wxss`。

- [ ] 写失败测试：`app.json` 注册 `pages/progress/index`；档案页含“开始体验”“收藏”；结果页含“学习报告”“查看我的进度”；活动页含“候选内测”；所有页面不含公开报名、专业认证、正式发布等用语。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认页面结构断言失败。
- [ ] 档案页加载路线、进度和收藏；结果页按 `reportId` 加载报告或显示安全空状态；进度页列出最新报告和收藏；活动页仅显示候选说明与完成路线数。每个仓储调用捕获异常并使用空数据。
- [ ] 重跑页面测试并提交：`git commit -m "feat: add candidate learning reports and progress pages"`。

### Task 5: 完整验证

**Files:** 只在测试证明需要时修改实现文件。

- [ ] 运行 `node --test tests/services/learning-repository.test.js tests/domain/experience-controller.test.js tests/page-shell.test.js`，确认 0 失败。
- [ ] 新增边界测试：学习闭环源文件不得匹配 `OPENID|UNIONID|phone|cloud.callFunction|collection(`。
- [ ] 运行 `npm test` 和 `git diff --check`，确认 0 失败和无空白错误。
- [ ] 在开发者工具手工验证：档案收藏并开始；完成三步骤时至少使用一次提示和重试；报告显示路线、用时、三步结果、提示/重试且无分数；重载后进度仍在；退出会话不计完成；存储失败仍可完成体验。
- [ ] 如验证引入修复，单独提交：`git commit -m "test: verify local learning loop boundaries"`。
