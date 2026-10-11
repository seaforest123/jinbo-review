# 博物馆数字展视觉改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将候选内测小程序改为暖白纸本、深褐展签、局部金箔细节与本地候选视觉示意组成的数字展体验。

**Architecture:** 本地候选素材清单提供稳定图片路径与候选说明；全局主题变量统一颜色、间距与边框；首页、档案、体验、结果、进度、活动只消费本地素材和既有数据。图片加载失败由页面保留文字展签与操作入口。

**Tech Stack:** 微信小程序 WXML/WXSS/JavaScript、PNG/WebP 本地候选素材、Node 内置测试运行器。

## Global Constraints

- 所有候选视觉相邻位置显示“候选视觉示意，尚待专业确认”。
- 本地图片只表现抽象纸张、金色纹理、非写实工具轮廓、光影与手势方向。
- 不使用真实工艺照片、人物、场馆、品牌、文物或可识别现实作品。
- 不新增网络请求、依赖、CloudBase、埋点、身份字段、云函数或远程资源。
- 图片缺失时必须显示候选说明和既有交互入口。

## File Structure

- 创建 `miniprogram/assets/candidate/`：一张封面、两张路线图、三张步骤图；文件名固定为 `cover.webp`、`route-making.webp`、`route-application.webp`、`step-observe.webp`、`step-motion.webp`、`step-inspect.webp`。
- 创建 `miniprogram/data/candidate-visuals.js`：素材路径、候选说明、按路线/步骤查询。
- 修改 `miniprogram/app.wxss`：暖白、深褐、金色、纸本阴影与展签变量。
- 修改六个页面的 WXML/WXSS/少量 JS：图片展签、任务导览线、候选失败文本。
- 创建 `tests/data/candidate-visuals.test.js`；修改 `tests/page-shell.test.js`。

### Task 1: 候选视觉资产与清单

**Files:** 创建六个 `miniprogram/assets/candidate/*.webp`；创建 `miniprogram/data/candidate-visuals.js`；创建 `tests/data/candidate-visuals.test.js`。

- [ ] 写失败测试：清单包含封面、两路线、三步骤共六个本地路径；路径都在 `assets/candidate/`；每项含统一候选说明；源内容不含真实人物、场馆、OpenID、UnionID、CloudBase 或 URL。
- [ ] 运行 `node --test tests/data/candidate-visuals.test.js`，确认模块缺失失败。
- [ ] 使用 imagegen 生成六张暖白、金箔肌理、抽象纸张层次的候选视觉图；每张无文字、无真实人物、无品牌。建立冻结清单和 `getRouteVisual(routeId)`、`getStepVisual(stepId)`。
- [ ] 重跑数据测试，确认全部通过；用图像查看工具检查六张图片是否可读、无文字伪影、无真实工艺断言。
- [ ] 提交：`git commit -m "feat: add candidate exhibit visuals"`。

### Task 2: 全局展签主题与首页

**Files:** 修改 `miniprogram/app.wxss`、`miniprogram/pages/home/index.js`、`.wxml`、`.wxss`、`tests/page-shell.test.js`。

- [ ] 写失败测试：首页引用候选视觉清单，包含封面图、候选视觉说明、路线缩略图与三节点刻度；模板不得包含外部图片 URL。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认新增断言失败。
- [ ] 定义暖白、深褐、金箔、纸本阴影变量；首页加载封面和路线视觉，使用 `image` 的 `binderror` 将失败项显示为候选展签色块；路线卡改为图文展签与节点刻度。
- [ ] 重跑页面测试并提交：`git commit -m "feat: style home as candidate exhibit"`。

### Task 3: 档案与体验视觉导览

**Files:** 修改 `miniprogram/pages/archive/index.js`、`.wxml`、`.wxss`；修改 `miniprogram/pages/experience/index.js`、`.wxml`、`.wxss`；修改 `tests/page-shell.test.js`。

- [ ] 写失败测试：档案页引用路线视觉与步骤视觉；体验页引用当前步骤视觉；两页都有候选视觉说明和图片错误回退处理；体验模板保留任务地图、步骤操作与退出入口。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认新增断言失败。
- [ ] 档案路线卡加入横幅图，知识卡加入对应步骤视觉区；体验页将任务地图改为导览线，当前步骤加入步骤图、编号与说明。所有图片 `binderror` 后显示展签文本，不清空卡片或按钮。
- [ ] 重跑页面测试并提交：`git commit -m "feat: add exhibit visuals to archive and experience"`。

### Task 4: 结果、进度与活动的统一展签

**Files:** 修改 `miniprogram/pages/result/index.js`、`.wxml`、`.wxss`；修改 `miniprogram/pages/progress/index.wxml`、`.wxss`；修改 `miniprogram/pages/activity/index.wxml`、`.wxss`；修改 `tests/page-shell.test.js`。

- [ ] 写失败测试：结果页回看卡带步骤视觉与候选说明；进度和活动页使用展签类；页面仍不含公开报名、正式发布或专业认证。
- [ ] 运行 `node --test tests/page-shell.test.js`，确认新增断言失败。
- [ ] 结果页卡片通过 `stepId` 映射步骤图，保留“本次已完成”标记；进度和活动页使用统一展签容器、边线和金色状态细节，不增加功能或数据。
- [ ] 重跑页面测试并提交：`git commit -m "feat: unify candidate exhibit surfaces"`。

### Task 5: 完整验证

**Files:** 只修改由测试证明需要的文件。

- [ ] 运行 `node --test tests/data/candidate-visuals.test.js tests/data/knowledge-cards.test.js tests/page-shell.test.js`，确认 0 失败。
- [ ] 运行 `npm test` 和 `git diff --check`，确认全量 0 失败、无空白错误。
- [ ] 用图像查看工具检查六张候选图；在开发者工具检查首页封面、两条路线图、档案六卡、体验三步骤图、结果回看图、图片失败回退与真机裁切。
- [ ] 如验证引入修复，单独提交：`git commit -m "test: verify candidate exhibit visual boundaries"`。
