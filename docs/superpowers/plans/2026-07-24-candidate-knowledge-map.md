# 候选知识卡与任务地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为两条候选路线提供可回看的三节点知识卡，并在体验中显示随步骤变化的任务地图。

**Architecture:** 以纯本地静态模块定义路线-步骤-知识卡的严格映射；页面通过只读查询模块取卡片。体验控制器向视图暴露步骤进度，页面据此绘制任务地图；不改变本地学习仓储和匿名埋点。

**Tech Stack:** 微信小程序 JavaScript/WXML/WXSS、CommonJS、Node 内置测试运行器。

## Global Constraints

- 仅允许配置内候选路线和 `observe`、`motion`、`inspect` 三个步骤。
- 所有卡片都显示“候选内测内容，尚待专业确认”。
- 不写历史年代、产地、人物、真实材料配方、真实技法结论或专业认证结论。
- 不记录 OpenID、UnionID 或其他身份数据。
- 不改变 `behavior_events`、匿名埋点、CloudBase 集合、云函数、权限、HTTP 入口或依赖。
- 未知路线、步骤或配置错误必须返回空结果，且不能阻断体验。

## File Structure

- 创建 `miniprogram/data/knowledge-cards.js`：六张候选卡与严格查询函数。
- 修改 `miniprogram/domain/experience-controller.js`：视图暴露按步骤的任务地图状态。
- 修改 `miniprogram/pages/home/index.wxml`：显示三个学习节点。
- 修改 `miniprogram/pages/experience/index.js`、`.wxml`、`.wxss`：任务地图和当前节点卡片展开。
- 修改 `miniprogram/pages/archive/index.js`、`.wxml`、`.wxss`：路线档案的三张卡。
- 修改 `miniprogram/pages/result/index.js`、`.wxml`、`.wxss`：报告后的三张回看卡与完成标记。
- 创建 `tests/data/knowledge-cards.test.js`；修改领域与页面壳层测试。

### Task 1: 静态候选知识卡模块

**Files:** 创建 `miniprogram/data/knowledge-cards.js`、`tests/data/knowledge-cards.test.js`。

- [ ] 写失败测试：两条路线各返回三张卡；每张的 `routeId`、`stepId` 和现有路线步骤严格匹配；未知查询返回 `null` 或空数组；所有卡片含统一候选说明，且源数据不含历史、地点、人物、认证、OpenID 或 UnionID 标记。
- [ ] 运行 `node --test tests/data/knowledge-cards.test.js`，确认模块不存在导致失败。
- [ ] 实现冻结的六张卡及 `listKnowledgeCards(routeId)`、`getKnowledgeCard(routeId, stepId)`；使用白名单路线和步骤，只返回复制后的安全数据。
- [ ] 重跑测试，确认所有静态数据与边界断言通过。
- [ ] 提交：`git commit -m "feat: add candidate knowledge cards"`。

### Task 2: 体验任务地图领域模型

**Files:** 修改 `miniprogram/domain/experience-controller.js`、`tests/domain/experience-controller.test.js`。

- [ ] 写失败测试：`getView().taskMap` 按路线三个步骤返回 `pending`、`current`、`completed`；开始 intro 后无当前节点，进入第一步后 `observe` 为当前；完成第一步后其为完成且 `motion` 为当前；完成后全部完成。
- [ ] 运行 `node --test tests/domain/experience-controller.test.js`，确认缺少 `taskMap` 的断言失败。
- [ ] 实现基于现有 `state.phase` 和 `state.stepIndex` 的只读 `taskMap`，每项只含 `stepId`、`title`、`status`；不改变现有状态迁移或埋点。
- [ ] 重跑控制器测试并提交：`git commit -m "feat: expose experience task map"`。

### Task 3: 体验页任务地图与节点说明

**Files:** 修改 `miniprogram/pages/experience/index.js`、`.wxml`、`.wxss`、`tests/page-shell.test.js`。

- [ ] 写失败测试：体验页模板含“学习节点”“查看本节点说明”“候选内测内容，尚待专业确认”；页面脚本引用知识卡模块；页面数据存在 `taskMap` 和 `activeKnowledgeCard`。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认新增断言失败。
- [ ] 在 `render()` 写入 `view.taskMap`，按 `view.route.id` 与 `view.step.id` 查询当前卡；新增 `toggleKnowledgeCard()`，只切换当前卡展开状态；模板循环任务地图并应用状态类，卡片显示标题、说明、观察提示和候选说明。
- [ ] 重跑页面测试并提交：`git commit -m "feat: add experience task map and knowledge cards"`。

### Task 4: 首页、档案和结果回看

**Files:** 修改 `miniprogram/pages/home/index.wxml`；修改 `miniprogram/pages/archive/index.js`、`.wxml`、`.wxss`；修改 `miniprogram/pages/result/index.js`、`.wxml`、`.wxss`；修改 `tests/page-shell.test.js`。

- [ ] 写失败测试：首页含“3 个学习节点”；档案模板含“候选知识卡”；结果模板含“回看学习节点”；档案和结果脚本引用知识卡模块；模板不含“专业认证”“正式发布”“公开报名”。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认断言失败。
- [ ] 首页路线卡增加节点数量。档案页给每条路线装配知识卡并支持展开/收起；结果页以 `routeId` 查询三张卡，根据本地报告 `steps` 标记已完成节点，报告缺失时仍展示卡片但不标完成。所有查询失败设为空数组。
- [ ] 重跑页面测试并提交：`git commit -m "feat: add candidate knowledge card review"`。

### Task 5: 完整验证

**Files:** 仅修改由测试证明需要调整的文件。

- [ ] 运行 `node --test tests/data/knowledge-cards.test.js tests/domain/experience-controller.test.js tests/page-shell.test.js`，确认 0 失败。
- [ ] 运行 `npm test` 与 `git diff --check`，确认全量 0 失败、无空白错误。
- [ ] 在开发者工具手工验收：首页每条路线显示 3 个节点；体验页三步任务地图变化且能展开当前说明；档案页可回看六张卡；结果页可回看三张卡并标记完成节点；所有页面均显示候选说明。
- [ ] 如验证出现修复，单独提交：`git commit -m "test: verify candidate knowledge map boundaries"`。
