# 金箔非遗小程序 P0 线上内测版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零建立一个可通过微信体验版二维码扫码访问、可完成“首页 → 双候选路线选择 → 三步轻量体验 → 结果页”闭环的微信原生小程序，并验证 CloudBase、匿名埋点、异常降级和真机较高保真交互。

**Architecture:** 采用微信原生小程序、CommonJS 纯函数领域模块和 CloudBase 四个集合。页面通过配置、状态机和交互适配器组合，不把制箔或贴箔写死；匿名身份由仅供小程序调用的云函数生成，事件由客户端仅追加写入并在失败时本地排队。

**Tech Stack:** 微信原生小程序、微信开发者工具、CloudBase、`wx-server-sdk 3.0.1`、Node.js 内置 `node:test`、CommonJS、Git／Gitee。

## Global Constraints

- 设计基线：`docs/superpowers/specs/2026-07-20-gold-foil-p0-trial-mini-program-design.md` V1.1。
- 第一阶段核心用户为广东高校学生，重点为18—24岁青年。
- 制箔和贴箔均保持 `internal_placeholder`，不得在专业确认前写成正式路线。
- 首页和体验页必须同时显示“候选示意，尚未经专业确认”。
- 内测主流程无需登录、手机号、微信号、姓名或问卷。
- 三步流程不设置失败、扣分、倒计时、分数、证书或排名。
- 至少一个步骤使用连续拖动交互，操作路径实时影响反馈，并在一台 iOS 与一台 Android 真机分别验收。
- 8秒显示慢加载提示，15秒切换至2D／图文替代路径。
- P0只创建 `app_config`、`content_items`、`media_assets`、`behavior_events`，不创建研究联系人或问卷集合。
- 客户端不得修改配置、审核状态或授权范围；`behavior_events` 只允许创建，不允许客户端读取、更新或删除。
- `wx-server-sdk` 云函数仅接受微信小程序调用；匿名 ID 不存储、不返回、不记录原始 OPENID。
- AppID、CloudBase 环境 ID、匿名盐值和审批人标识不得作为密钥提交到 Git。
- 严格 TDD 适用于路线配置、状态机、降级、拖动反馈、身份、埋点队列和审批校验；展示样式可先实现，但交付前必须有关键路径测试。
- 第一轮只发布微信体验版，不提交正式公开审核。

**V1.1 技术映射说明：** 第 7.1 节所述“`wx.login` code 换取 OPENID”由 CloudBase 在可信云函数上下文中通过 `cloud.getWXContext()`完成；客户端不提交 code 或 OPENID，云函数仍只用该 OPENID 生成不可逆匿名 ID。该映射不改变“服务端生成、原始 OPENID 不存储／不返回／不记录”的既定边界。

---

## 目标文件结构

```text
.
├─ cloudbase/
│  ├─ database-rules/
│  │  ├─ app_config.json
│  │  ├─ behavior_events.json
│  │  ├─ content_items.json
│  │  └─ media_assets.json
│  ├─ seed/
│  │  ├─ app_config.json
│  │  ├─ behavior_events.json
│  │  ├─ content_items.json
│  │  └─ media_assets.json
│  └─ README.md
├─ cloudfunctions/
│  ├─ bootstrapAnonymousId/
│  │  ├─ index.js
│  │  ├─ package.json
│  │  └─ lib/hash-identity.js
│  └─ confirmRoute/
│     ├─ index.js
│     ├─ package.json
│     └─ lib/approval.js
├─ docs/
│  ├─ deployment/P0体验版发布记录.md
│  └─ testing/P0验收记录.md
├─ miniprogram/
│  ├─ components/
│  │  ├─ continuous-drag-step/
│  │  ├─ inspect-step/
│  │  └─ select-step/
│  ├─ config/runtime-config.js
│  ├─ data/routes.js
│  ├─ domain/
│  │  ├─ drag-feedback.js
│  │  ├─ experience-machine.js
│  │  └─ route-config.js
│  ├─ pages/
│  │  ├─ activity/
│  │  ├─ archive/
│  │  ├─ experience/
│  │  ├─ home/
│  │  └─ result/
│  ├─ services/
│  │  ├─ capability.js
│  │  ├─ content-repository.js
│  │  ├─ event-tracker.js
│  │  └─ identity.js
│  ├─ app.js
│  ├─ app.json
│  ├─ app.wxss
│  └─ sitemap.json
├─ tests/
│  ├─ cloudfunctions/
│  ├─ domain/
│  ├─ pages/
│  ├─ services/
│  └─ scaffold.test.js
├─ .gitignore
├─ package.json
└─ project.config.example.json
```

### Task 1: 对齐远程历史并版本化迁移基线

**Files:**
- Verify: `00_项目交接与总览/迁移文件清单_SHA256.csv`
- Add: `00_项目交接与总览/**`
- Add: `01_项目简报与产品需求/**`
- Add: `02_团队任务与项目启动/**`
- Add: `03_首次专业访谈/**`
- Add: `90_制作与校验脚本/**`
- Add: `README_项目文件导航.md`
- Preserve: remote `README.md`, `README.en.md`

**Interfaces:**
- Consumes: local `master` at or after commit `9b73b06`, remote `origin/master` at or after `a4f8e77`.
- Produces: one history containing Gitee initialization, approved design documents, and all checksum-verified migration materials.

- [ ] **Step 1: Fetch and inspect the remote initialization commit**

Run:

```powershell
git fetch origin master
git log --oneline --decorate --graph --all -10
git diff --name-status master..origin/master
```

Expected: `origin/master` contains the Gitee initialization README files; no local project file is overwritten.

- [ ] **Step 2: Merge the unrelated histories without discarding either side**

Run:

```powershell
git merge origin/master --allow-unrelated-histories --no-edit
```

Expected: merge succeeds; `README.md` and `README.en.md` remain present; canonical Chinese navigation remains `README_项目文件导航.md`.

- [ ] **Step 3: Recompute all migration checksums**

Run:

```powershell
$manifest = Import-Csv '00_项目交接与总览\迁移文件清单_SHA256.csv'
$failures = @()
foreach ($row in $manifest) {
  $path = Join-Path (Get-Location) $row.RelativePath
  if (!(Test-Path -LiteralPath $path)) { $failures += "MISSING $($row.RelativePath)"; continue }
  $item = Get-Item -LiteralPath $path
  $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
  if ($item.Length -ne [int64]$row.Bytes -or $hash -ne $row.SHA256) {
    $failures += "MISMATCH $($row.RelativePath)"
  }
}
if ($failures.Count) { $failures; exit 1 }
"PASS entries=$($manifest.Count)"
```

Expected: `PASS entries=38`.

- [ ] **Step 4: Commit only the migrated baseline materials**

Run:

```powershell
git add -- 00_项目交接与总览 01_项目简报与产品需求 02_团队任务与项目启动 03_首次专业访谈 90_制作与校验脚本 README_项目文件导航.md
git diff --cached --check
git commit -m "docs: import gold foil project baseline"
```

Expected: all migration materials become tracked; system source files are not yet present.

### Task 2: 建立可导入微信开发者工具的工程骨架

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `project.config.example.json`
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/sitemap.json`
- Create: `miniprogram/config/runtime-config.js`
- Test: `tests/scaffold.test.js`

**Interfaces:**
- Consumes: no application code.
- Produces: `runtimeConfig` object, CloudBase initialization, five registered pages, reusable visual tokens, and a dependency-free `node --test` command.

- [ ] **Step 1: Write the failing scaffold contract test**

```js
// tests/scaffold.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('registers the five P0 pages and cloud roots', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json'), 'utf8'));
  assert.deepEqual(app.pages, [
    'pages/home/index',
    'pages/experience/index',
    'pages/result/index',
    'pages/archive/index',
    'pages/activity/index',
  ]);
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  assert.equal(project.cloudfunctionRoot, 'cloudfunctions/');
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/scaffold.test.js
```

Expected: FAIL with `ENOENT` for `miniprogram/app.json`.

- [ ] **Step 3: Create the minimal project configuration**

Use these exact configuration values:

```json
// package.json
{
  "name": "gold-foil-heritage-mini-program",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

```json
// project.config.example.json
{
  "appid": "touristappid",
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true
  }
}
```

```js
// miniprogram/config/runtime-config.js
module.exports = Object.freeze({
  appVersion: '0.1.0-trial',
  displayEnvironment: 'trial',
  cloudEnvId: null,
  eventSource: 'internal_trial',
  testAccountTag: null,
});
```

```js
// miniprogram/app.js
const runtimeConfig = require('./config/runtime-config');

App({
  globalData: { runtimeConfig, anonymousId: null },
  onLaunch() {
    if (!wx.cloud) throw new Error('当前微信基础库不支持云开发');
    const options = { traceUser: true };
    if (runtimeConfig.cloudEnvId) options.env = runtimeConfig.cloudEnvId;
    wx.cloud.init(options);
  },
});
```

`miniprogram/app.json` uses the page list in the test, `window.navigationBarTitleText` is `金箔数字轻体验`, and `style` is `v2`. `sitemap.json` uses `{"rules":[{"action":"allow","page":"*"}]}`.

`.gitignore` contains:

```gitignore
project.config.json
project.private.config.json
node_modules/
cloudfunctions/**/node_modules/
coverage/
.tmp*/
```

- [ ] **Step 4: Add the shared visual tokens**

`miniprogram/app.wxss` defines `--gold: #b88a2a`, `--deep-brown: #3b2a1f`, `--warm-white: #fffaf0`, `--muted-gold: #e8d7ad`, a 32rpx page gutter, 20rpx card radius, visible focus/active states, and body text no smaller than 28rpx.

- [ ] **Step 5: Run the test and verify GREEN**

Run the command from Step 2.

Expected: PASS, one test, zero warnings.

- [ ] **Step 6: Commit**

```powershell
git add .gitignore package.json project.config.example.json miniprogram tests/scaffold.test.js
git commit -m "build: scaffold native mini program"
```

### Task 3: 实现双候选路线配置与环境可见性

**Files:**
- Create: `miniprogram/domain/route-config.js`
- Create: `miniprogram/data/routes.js`
- Create: `miniprogram/services/content-repository.js`
- Test: `tests/domain/route-config.test.js`
- Test: `tests/services/content-repository.test.js`

**Interfaces:**
- Consumes: `runtimeConfig.displayEnvironment`.
- Produces: `validateRoute(route)`, `getVisibleRoutes(routes, environment)`, `createContentRepository({ database, localRoutes })`, and two internal candidate route records.

- [ ] **Step 1: Write failing route validation tests**

```js
// tests/domain/route-config.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRoute, getVisibleRoutes } = require('../../miniprogram/domain/route-config');

const valid = {
  id: 'foil_making_candidate',
  displayName: '制箔候选路线',
  status: 'internal_placeholder',
  reviewStatus: 'internal_approved',
  allowedEnvironments: ['development', 'trial'],
  steps: [
    { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
    { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
    { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
  ],
};

test('accepts exactly three ordered internal candidate steps', () => {
  assert.equal(validateRoute(valid).steps.length, 3);
});

test('rejects a route with duplicate or unordered step order', () => {
  const bad = { ...valid, steps: valid.steps.map((step) => ({ ...step, order: 1 })) };
  assert.throws(() => validateRoute(bad), /步骤顺序必须是 1,2,3/);
});

test('hides internal candidates from production', () => {
  assert.equal(getVisibleRoutes([valid], 'production').length, 0);
  assert.equal(getVisibleRoutes([valid], 'trial').length, 1);
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/domain/route-config.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement validation and the two route records**

`route-config.js` exports a `RouteConfigError` and implements:

```js
const STATUSES = new Set(['internal_placeholder', 'candidate', 'confirmed']);
const ADAPTERS = new Set(['select', 'continuous-drag', 'inspect', 'xr-frame']);

function validateRoute(route) {
  if (!route || typeof route.id !== 'string' || !route.id) throw new RouteConfigError('路线缺少 id');
  if (!STATUSES.has(route.status)) throw new RouteConfigError('路线状态无效');
  if (!Array.isArray(route.steps) || route.steps.length !== 3) throw new RouteConfigError('路线必须包含三个步骤');
  const orders = route.steps.map((step) => step.order).join(',');
  if (orders !== '1,2,3') throw new RouteConfigError('步骤顺序必须是 1,2,3');
  const ids = new Set(route.steps.map((step) => step.id));
  if (ids.size !== 3) throw new RouteConfigError('步骤 id 必须唯一');
  if (route.steps.some((step) => !ADAPTERS.has(step.adapter))) throw new RouteConfigError('交互适配器无效');
  return Object.freeze({ ...route, steps: route.steps.map((step) => Object.freeze({ ...step })) });
}

function getVisibleRoutes(routes, environment) {
  return routes.map(validateRoute).filter((route) => route.allowedEnvironments.includes(environment));
}
```

`routes.js` defines `foil_making_candidate` and `foil_application_candidate`; both use `internal_placeholder`, `internal_approved`, `['development','trial']`, the three generic titles from the test, and the banner `候选示意，尚未经专业确认`. Do not include real tools, materials, historical claims, people, organizations, levels, or technique instructions.

- [ ] **Step 4: Test the content repository cloud-first fallback**

`content-repository.test.js` verifies that `loadRoutes('trial')` returns CloudBase records when `database.collection('app_config').where(...).get()` succeeds and validated local routes when it rejects. The query must include both `allowedEnvironment: 'trial'` and a permitted `reviewStatus` condition.

Implement `createContentRepository({ database, localRoutes })` with `loadRoutes(environment)`; log only the error code on fallback and never log document content.

- [ ] **Step 5: Run all Task 3 tests**

Run:

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/domain/route-config.test.js tests/services/content-repository.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add miniprogram/domain/route-config.js miniprogram/data/routes.js miniprogram/services/content-repository.js tests/domain/route-config.test.js tests/services/content-repository.test.js
git commit -m "feat: add configurable candidate routes"
```

### Task 4: 实现体验状态机与连续拖动反馈

**Files:**
- Create: `miniprogram/domain/experience-machine.js`
- Create: `miniprogram/domain/drag-feedback.js`
- Test: `tests/domain/experience-machine.test.js`
- Test: `tests/domain/drag-feedback.test.js`

**Interfaces:**
- Consumes: a validated route with three steps.
- Produces: `createInitialState()`, `reduceExperience(state, event, route, now)`, `calculateDragFeedback({ start, current, targetDirection, requiredDistance })`.

- [ ] **Step 1: Write the failing state-machine tests**

```js
// tests/domain/experience-machine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialState, reduceExperience } = require('../../miniprogram/domain/experience-machine');

const route = { steps: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };

test('runs intro and three ordered steps before completion', () => {
  let state = createInitialState();
  state = reduceExperience(state, { type: 'START' }, route, 1000);
  assert.equal(state.phase, 'intro');
  state = reduceExperience(state, { type: 'INTRO_ENDED' }, route, 1100);
  assert.deepEqual([state.phase, state.stepIndex], ['step', 0]);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1200);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1300);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1400);
  assert.deepEqual([state.phase, state.completedAt], ['completed', 1400]);
});

test('counts hints and retries for the current step', () => {
  let state = reduceExperience(createInitialState(), { type: 'START' }, route, 1000);
  state = reduceExperience(state, { type: 'INTRO_ENDED' }, route, 1100);
  state = reduceExperience(state, { type: 'HINT' }, route, 1200);
  state = reduceExperience(state, { type: 'RETRY' }, route, 1300);
  assert.equal(state.hints.s1, 1);
  assert.equal(state.retries.s1, 1);
});
```

- [ ] **Step 2: Run and verify RED**

Run `node --test tests/domain/experience-machine.test.js` with the bundled Node path.

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure reducer**

The state shape is exactly:

```js
{
  phase: 'idle',
  stepIndex: -1,
  startedAt: null,
  completedAt: null,
  exitedAt: null,
  hints: {},
  retries: {}
}
```

Valid events are `START`, `INTRO_ENDED`, `HINT`, `RETRY`, `COMPLETE_STEP`, and `EXIT`. Reject events after `completed` or `exited`; reject `COMPLETE_STEP` outside `step`; move to `completed` only after the third step.

- [ ] **Step 4: Write drag-feedback tests before implementation**

```js
// tests/domain/drag-feedback.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDragFeedback } = require('../../miniprogram/domain/drag-feedback');

test('maps continuous movement in the target direction to progress', () => {
  const feedback = calculateDragFeedback({
    start: { x: 10, y: 10 },
    current: { x: 90, y: 18 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });
  assert.equal(feedback.progress, 0.8);
  assert.equal(feedback.directionOk, true);
  assert.equal(feedback.complete, true);
});

test('does not count a mostly vertical path as horizontal progress', () => {
  const feedback = calculateDragFeedback({
    start: { x: 10, y: 10 },
    current: { x: 25, y: 100 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });
  assert.equal(feedback.directionOk, false);
  assert.equal(feedback.complete, false);
});
```

- [ ] **Step 5: Implement continuous feedback**

Calculate `dx`, `dy`, absolute primary and secondary distances, require primary distance to be at least secondary distance, clamp progress to `[0,1]`, round to two decimals, and set `complete` only when `directionOk && progress >= 0.8`. Return `{ progress, directionOk, complete, primaryDistance }`.

- [ ] **Step 6: Run tests and commit**

Run both Task 4 test files; expected PASS.

```powershell
git add miniprogram/domain/experience-machine.js miniprogram/domain/drag-feedback.js tests/domain/experience-machine.test.js tests/domain/drag-feedback.test.js
git commit -m "feat: add experience state and drag feedback"
```

### Task 5: 实现能力检测与 8/15 秒降级策略

**Files:**
- Create: `miniprogram/services/capability.js`
- Test: `tests/services/capability.test.js`

**Interfaces:**
- Consumes: elapsed milliseconds, load-failure state, requested adapter, and runtime capability flags.
- Produces: `evaluateLoadState(elapsedMs, failed)` and `chooseAdapter(preferred, capabilities)`.

- [ ] **Step 1: Write failing capability tests**

```js
// tests/services/capability.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLoadState, chooseAdapter } = require('../../miniprogram/services/capability');

test('uses the fixed 8-second warning and 15-second fallback thresholds', () => {
  assert.equal(evaluateLoadState(7999, false), 'loading');
  assert.equal(evaluateLoadState(8000, false), 'slow');
  assert.equal(evaluateLoadState(14999, false), 'slow');
  assert.equal(evaluateLoadState(15000, false), 'fallback');
  assert.equal(evaluateLoadState(1, true), 'fallback');
});

test('falls back to the simplest available adapter', () => {
  assert.equal(chooseAdapter('xr-frame', { xrFrame: false, continuousDrag: true }), 'continuous-drag');
  assert.equal(chooseAdapter('continuous-drag', { continuousDrag: false }), 'select');
  assert.equal(chooseAdapter('inspect', {}), 'inspect');
});
```

- [ ] **Step 2: Run and verify RED**

Run the test with the bundled Node executable. Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the policy without platform side effects**

`evaluateLoadState` must reject negative or non-finite durations, return `fallback` immediately on failure, and otherwise return only `loading`, `slow`, or `fallback`. `chooseAdapter` keeps `select` and `inspect`, accepts `continuous-drag` only when `capabilities.continuousDrag !== false`, and accepts `xr-frame` only when `capabilities.xrFrame === true`; its fallback order is `xr-frame -> continuous-drag -> select`.

- [ ] **Step 4: Run tests and commit**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/services/capability.test.js
git add miniprogram/services/capability.js tests/services/capability.test.js
git commit -m "feat: add capability-aware degradation"
```

### Task 6: 实现匿名身份、会话与埋点离线队列

**Files:**
- Create: `miniprogram/services/identity.js`
- Create: `miniprogram/services/event-tracker.js`
- Test: `tests/services/identity.test.js`
- Test: `tests/services/event-tracker.test.js`

**Interfaces:**
- Consumes: injected storage, CloudBase call transport, event transport, clock, ID factory, and route context.
- Produces: `createIdentityService({ storage, cloudCall, idFactory })` and `createEventTracker({ storage, transport, clock, idFactory, context })`.

- [ ] **Step 1: Write failing identity tests**

Test that `getAnonymousId()` returns `goldFoilAnonymousId` from storage without a network call; on a cache miss it calls only `bootstrapAnonymousId`, persists the returned opaque ID, and never accepts an OpenID from caller input. Test that `createSessionId()` returns a fresh `session_`-prefixed ID for each experience.

- [ ] **Step 2: Run identity tests and verify RED**

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement identity service**

Use storage key `goldFoilAnonymousId`. Validate that the cloud response matches `anon_[a-f0-9]{32}` before caching it. Generate session IDs from the injected `idFactory`, not personal/device data. Expose no raw platform identifier in logs, storage, or return values.

- [ ] **Step 4: Write failing event tracker tests**

Cover all of the following:

- every event receives `eventId`, `anonymousId`, `sessionId`, `routeId`, `appVersion`, `deviceCapabilities`, `testAccountTag`, `environment`, `source`, `name`, and ISO `occurredAt`;
- `source` is `internal_trial` during normal internal testing and `test` in automated tests;
- allowed event names are exactly `home_cta_click`, `experience_start`, `video_play`, `video_skip`, `step_start`, `step_hint`, `step_retry`, `step_complete`, `experience_exit`, `experience_complete`, and `result_action`;
- failed transport writes append to the `goldFoilEventQueue` storage key;
- `flush()` sends queued events FIFO and removes only acknowledged entries;
- event properties containing `openid`, `unionid`, phone, email, name, address, or free-form text are rejected.

- [ ] **Step 5: Implement event tracking and queue recovery**

`track(name, properties)` creates an immutable record, validates the allowlist, tries one transport write, and queues on failure. `flush()` reads at most 50 records per invocation and stops at the first failure to preserve order. Limit `properties` to scalar values on the explicit keys `stepId`, `adapter`, `reason`, `action`, `elapsedMs`, `hintCount`, and `retryCount`.

- [ ] **Step 6: Run tests and commit**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/services/identity.test.js tests/services/event-tracker.test.js
git add miniprogram/services/identity.js miniprogram/services/event-tracker.js tests/services/identity.test.js tests/services/event-tracker.test.js
git commit -m "feat: add anonymous trial analytics"
```

### Task 7: 实现 CloudBase 云函数与最小权限规则

**Files:**
- Create: `cloudfunctions/bootstrapAnonymousId/index.js`
- Create: `cloudfunctions/bootstrapAnonymousId/package.json`
- Create: `cloudfunctions/bootstrapAnonymousId/lib/hash-identity.js`
- Create: `cloudfunctions/confirmRoute/index.js`
- Create: `cloudfunctions/confirmRoute/package.json`
- Create: `cloudfunctions/confirmRoute/lib/approval.js`
- Create: `cloudbase/database-rules/behavior_events.json`
- Create: `cloudbase/database-rules/app_config.json`
- Create: `cloudbase/database-rules/content_items.json`
- Create: `cloudbase/database-rules/media_assets.json`
- Create: `cloudbase/README.md`
- Test: `tests/cloudfunctions/hash-identity.test.js`
- Test: `tests/cloudfunctions/approval.test.js`
- Test: `tests/cloudbase/security-rules.test.js`

**Interfaces:**
- `bootstrapAnonymousId` consumes the trusted CloudBase mini-program context and returns `{ anonymousId }`.
- `confirmRoute` consumes `{ routeId, contentItemId }`, verifies the current reviewer server-side, and updates approved configuration server-side.
- Security rules allow only the reads and event creates required by the trial build; clients cannot mutate content/configuration.

- [ ] **Step 1: Write failing pure-function and rule-manifest tests**

Test `hashIdentity(openid, salt)` for deterministic `anon_` plus 32 lowercase hexadecimal characters, different salts, and rejection of blank input. Test `isAuthorizedReviewer(anonymousId, reviewerIds)` and `buildConfirmedRoute(candidate, contentItem)` for explicit authorization, matching route IDs, and required `reviewStatus === 'reviewed'`.

The security-rules test reads every JSON file and asserts:

- `behavior_events.read/update/delete` are `false` and `create` is `doc._openid == auth.openid`;
- the other three collections have `write: false`;
- their read expressions require both `allowedEnvironment == 'trial'` and an approved review status;
- no rule contains a wildcard write or unconditional `true` write.

- [ ] **Step 2: Run and verify RED**

Run all three test files. Expected: FAIL because modules and rule files do not exist.

- [ ] **Step 3: Implement anonymous hashing and bootstrap function**

Use Node `crypto.createHmac('sha256', salt)` and retain the first 32 hex characters. The cloud function initializes `wx-server-sdk` with `cloud.DYNAMIC_CURRENT_ENV`, obtains `OPENID` only through `cloud.getWXContext()`, reads `ANONYMIZATION_SALT` from the cloud-function environment, and returns only the opaque ID. Reject missing salt and never log raw or hashed identifiers.

Both cloud-function `package.json` files pin `wx-server-sdk` to `3.0.1` and use `index.js` as `main`.

- [ ] **Step 4: Implement the protected approval function**

`confirmRoute` derives the caller's anonymous ID from the trusted context, compares it to the comma-separated `APPROVER_IDS` environment variable, reads the named `content_items` document, validates it with the pure approval module, and writes the confirmed route into `app_config`. Reject unknown request fields, unauthorized callers, unreviewed records, cross-route records, and production targets. Do not provide any client-side direct write path.

- [ ] **Step 5: Add least-privilege rules and operator documentation**

Use this exact event-write rule:

```json
{
  "read": false,
  "create": "doc._openid == auth.openid",
  "update": false,
  "delete": false
}
```

For `app_config`, `content_items`, and `media_assets`, use `write: false`; permit reads only where `doc.allowedEnvironment == 'trial'` and `doc.reviewStatus` is in `['internal_approved', 'reviewed', 'published']`. In `cloudbase/README.md`, document collection creation, rules deployment, function deployment, and the required environment variables; link to the official CloudBase security-rules and mini-program cloud-function documentation.

- [ ] **Step 6: Run tests and commit**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/cloudfunctions/hash-identity.test.js tests/cloudfunctions/approval.test.js tests/cloudbase/security-rules.test.js
git add cloudfunctions cloudbase tests/cloudfunctions tests/cloudbase
git commit -m "feat: secure CloudBase trial backend"
```

### Task 8: 实现首页、档案、活动与结果页壳层

**Files:**
- Create: `miniprogram/pages/home/index.js`
- Create: `miniprogram/pages/home/index.json`
- Create: `miniprogram/pages/home/index.wxml`
- Create: `miniprogram/pages/home/index.wxss`
- Create: `miniprogram/pages/archive/index.js`
- Create: `miniprogram/pages/archive/index.json`
- Create: `miniprogram/pages/archive/index.wxml`
- Create: `miniprogram/pages/archive/index.wxss`
- Create: `miniprogram/pages/activity/index.js`
- Create: `miniprogram/pages/activity/index.json`
- Create: `miniprogram/pages/activity/index.wxml`
- Create: `miniprogram/pages/activity/index.wxss`
- Create: `miniprogram/pages/result/index.js`
- Create: `miniprogram/pages/result/index.json`
- Create: `miniprogram/pages/result/index.wxml`
- Create: `miniprogram/pages/result/index.wxss`
- Create: `miniprogram/pages/home/controller.js`
- Create: `miniprogram/pages/result/controller.js`
- Test: `tests/pages/home-controller.test.js`
- Test: `tests/pages/result-controller.test.js`
- Test: `tests/pages/page-copy.test.js`

**Interfaces:**
- Page controllers receive injected tracker/navigation functions for Node tests.
- Home emits `home_cta_click` and navigates to `/pages/experience/index`.
- Result emits `result_action` with an explicit `action` property and never presents a score or expert conclusion.

- [ ] **Step 1: Write failing controller and copy tests**

Test CTA tracking before navigation, result restart/home/archive/activity actions, route candidate selection, and exact inclusion of `开始3分钟体验`, `候选示意，尚未经专业确认`, and `你完成的是数字化轻量体验，不代表已经掌握真实工艺`. Scan the four WXML files to reject score labels, rankings, certificates, authenticating language, real-person names, factual process claims, external sign-up forms, phone numbers, and email addresses.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because controllers and page files do not exist.

- [ ] **Step 3: Implement pages with candidate-only language**

Home shows the project title, the fixed disclaimer, the primary CTA, and two selectable candidate-route cards. Its launch handler accepts only a bounded `testAccountTag` from the authorized tester entry parameter and passes it into tracker context independently from the anonymous ID. Archive and activity remain read-only internal-preview pages with explicit “资料尚待专业确认/活动尚未开放” states. Result shows completion, duration, hint/retry summary, the fixed digital-experience disclaimer, `再体验一次`, `金箔志`, `活动`, and `返回首页`; do not show a score, ranking, certificate, or factual expertise claim.

Keep colors, spacing, focus states, tap targets, and text scale tokens in `app.wxss`; page styles may consume but not redefine those tokens.

- [ ] **Step 4: Run tests and commit**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/pages/home-controller.test.js tests/pages/result-controller.test.js tests/pages/page-copy.test.js
git add miniprogram/pages tests/pages miniprogram/app.wxss
git commit -m "feat: add trial page shell"
```

### Task 9: 实现三步体验页与可降级交互组件

**Files:**
- Create: `miniprogram/components/select-step/select-step.js`
- Create: `miniprogram/components/select-step/select-step.json`
- Create: `miniprogram/components/select-step/select-step.wxml`
- Create: `miniprogram/components/select-step/select-step.wxss`
- Create: `miniprogram/components/continuous-drag-step/continuous-drag-step.js`
- Create: `miniprogram/components/continuous-drag-step/continuous-drag-step.json`
- Create: `miniprogram/components/continuous-drag-step/continuous-drag-step.wxml`
- Create: `miniprogram/components/continuous-drag-step/continuous-drag-step.wxss`
- Create: `miniprogram/components/inspect-step/inspect-step.js`
- Create: `miniprogram/components/inspect-step/inspect-step.json`
- Create: `miniprogram/components/inspect-step/inspect-step.wxml`
- Create: `miniprogram/components/inspect-step/inspect-step.wxss`
- Create: `miniprogram/pages/experience/controller.js`
- Create: `miniprogram/pages/experience/index.js`
- Create: `miniprogram/pages/experience/index.json`
- Create: `miniprogram/pages/experience/index.wxml`
- Create: `miniprogram/pages/experience/index.wxss`
- Test: `tests/pages/experience-controller.test.js`
- Test: `tests/components/continuous-drag-step.test.js`
- Test: `tests/integration/experience-flow.test.js`

**Interfaces:**
- `createExperienceController({ route, tracker, navigate, clock, capabilities })` orchestrates the pure state machine.
- Components emit only `complete`, `hint`, and `retry`; page controller owns state and analytics.
- Continuous drag consumes touch coordinates, calls `calculateDragFeedback`, updates progress on every move, and completes on touch end only at the 0.8 threshold.

- [ ] **Step 1: Write failing controller tests**

Using fake tracker, clock, and navigation, verify this event sequence: `experience_start`, `video_play`, optional `video_skip`, `step_start` for step 1, step hint/retry events, three `step_complete` events with the next `step_start`, then `experience_complete` and navigation to result. Verify early exit records `experience_exit` with the current step and reason.

- [ ] **Step 2: Write failing continuous-drag component tests**

Extract component behavior into exported pure handlers so Node tests can verify initial progress `0`, progress updates on every `touchmove`, wrong-direction feedback, completion at `>= 0.8`, and no completion below the threshold.

- [ ] **Step 3: Run and verify RED**

Expected: FAIL because page/controller/component modules are absent.

- [ ] **Step 4: Implement the page controller and adapters**

Load one of the two visible candidate routes from the content repository, create a fresh session, flush queued events, and start the 3—5 second silent-readable intro. Render a fixed progress indicator (`1/3` through `3/3`), skip-intro action, help/retry actions, the fixed candidate disclaimer, and exactly one adapter component per step. If the intro video fails, show its cover, subtitle summary, and skip action, then allow the user to proceed without reloading.

Run `chooseAdapter` before rendering. If the preferred adapter cannot load, show the 8-second slow message and switch at 15 seconds or on error. Keep the same step ID and analytics context across a fallback.

- [ ] **Step 5: Implement continuous visual feedback**

The drag component updates its bar, direction message, and motion transform from `calculateDragFeedback` on each move. It emits `complete` once on touch end when complete, resets after an invalid release, and supports the select fallback without changing route content.

- [ ] **Step 6: Add the integration test**

Drive both candidate route IDs through intro, three steps, completion, and restart using fake transports. Assert total duration is recorded, all event records carry the same anonymous/session/route/version/device-capability/test-account context, a new restart creates a new session ID, and no route exposes unapproved factual content. Simulate a network interruption mid-step and verify the current state survives, the user can finish through a fallback, and queued events flush in order after recovery.

- [ ] **Step 7: Run tests and commit**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test tests/pages/experience-controller.test.js tests/components/continuous-drag-step.test.js tests/integration/experience-flow.test.js
git add miniprogram/components miniprogram/pages/experience tests/pages/experience-controller.test.js tests/components/continuous-drag-step.test.js tests/integration/experience-flow.test.js
git commit -m "feat: deliver three-step candidate experience"
```

### Task 10: 补齐种子数据、项目接入说明与全量自动化验收

**Files:**
- Create: `cloudbase/seed/app_config.json`
- Create: `cloudbase/seed/content_items.json`
- Create: `cloudbase/seed/media_assets.json`
- Create: `cloudbase/seed/behavior_events.json`
- Create: `tests/cloudbase/seed.test.js`
- Create: `tests/integration/p0-contract.test.js`
- Modify: `README.md`
- Modify: `project.config.example.json`

**Interfaces:**
- Seed files define only trial-safe internal records and contain no credentials or personal identifiers.
- `README.md` is the single setup entry point for WeChat DevTools, AppID, CloudBase environment binding, test commands, and deployment handoff.

- [ ] **Step 1: Write failing seed and P0 contract tests**

The seed test verifies valid JSON, unique IDs, `allowedEnvironment: 'trial'`, permitted review states, zero production records, an empty behavior-event seed, and no personal/contact fields. The contract test verifies all required pages in `app.json`, both candidate routes, exactly three ordered steps, 8/15-second thresholds, the full event allowlist, required security-rule files, fixed disclaimer copy, and absence of banned factual or commercial claims.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because seed and contract files are missing.

- [ ] **Step 3: Add safe seed data**

`app_config.json` contains the two candidate route documents and a trial feature-flags document. `content_items.json` contains only generic candidate instructions tied to those route IDs. `media_assets.json` uses local placeholder asset paths with `internal_approved` metadata. `behavior_events.json` is `[]`. Do not insert real craft facts, personal data, OpenIDs, salts, approver IDs, AppIDs, or CloudBase environment IDs.

- [ ] **Step 4: Complete setup documentation and local configuration flow**

Replace the generic Gitee README with project-specific instructions. Tell operators to copy `project.config.example.json` to ignored `project.config.json`, then enter the actual AppID and CloudBase environment ID locally. Include exact commands for tests, seed import order, function deployment, rules application, local preview, experience-version upload, and rollback. State that AppID/environment identifiers may be local configuration, while credentials, salts, session keys, and reviewer identifiers must never be committed.

- [ ] **Step 5: Run full automated verification**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
git diff --check
git status --short
```

Expected: all tests PASS; `git diff --check` prints nothing; only intended Task 10 files remain unstaged.

- [ ] **Step 6: Commit**

```powershell
git add cloudbase/seed tests/cloudbase/seed.test.js tests/integration/p0-contract.test.js README.md project.config.example.json
git commit -m "docs: complete trial setup and seed data"
```

### Task 11: 部署体验版并完成高保真双端验收

**Files:**
- Create: `docs/testing/P0验收记录.md`
- Create: `docs/deployment/P0体验版发布记录.md`
- Modify: `docs/testing/P0验收记录.md` after each physical-device run
- Modify: `docs/deployment/P0体验版发布记录.md` after deployment

**Interfaces:**
- Requires: the project owner's WeChat Mini Program AppID, a CloudBase environment, authenticated WeChat DevTools, and one iOS plus one Android test device.
- Produces: a scannable trial-version QR code in WeChat DevTools and evidence-backed acceptance/deployment records; no QR image or credential is committed unless explicitly approved.

- [ ] **Step 1: Create fixed acceptance and release record templates**

The acceptance record contains dated rows for device model, OS, WeChat version, first-load time, intro skip, both routes, all three steps, continuous feedback, 8/15-second fallback, exit/re-entry, result actions, and observed analytics. The release record contains commit SHA, DevTools version, AppID suffix only, CloudBase environment alias, deployed function versions, rules-applied confirmation, first-professional-interview status and date (or expected date), upload version, upload time, QR availability, known issues, rollback commit, and operator.

- [ ] **Step 2: Configure the local WeChat project without committing identifiers**

Create ignored `project.config.json` from the example, set the owner's AppID, set `miniprogramRoot` and `cloudfunctionRoot`, and bind `runtime-config.local.js` to the intended CloudBase environment. Confirm `git status --short` does not expose either local file.

- [ ] **Step 3: Provision CloudBase in least-privilege order**

Create `app_config`, `content_items`, `media_assets`, and `behavior_events`; apply security rules before importing seeds; deploy `bootstrapAnonymousId` and `confirmRoute`; set `ANONYMIZATION_SALT` and `APPROVER_IDS` only in cloud-function environment variables; import the three non-empty seed files; query each collection to confirm trial-only visibility.

- [ ] **Step 4: Run developer-tool smoke tests**

In WeChat DevTools, compile from a clean cache and exercise both route candidates. Confirm no console errors, no unauthorized writes, one anonymous ID per install, a fresh session per experience, queued-event recovery after a forced network failure, and fallback behavior at the fixed thresholds.

- [ ] **Step 5: Upload the experience version**

Use an incremented trial version such as `0.1.0`, with description `金箔非遗数字体验 P0 内测版（候选示意）`. Record the exact version and timestamp, then generate the WeChat experience QR code for authorized testers. Do not submit for public review or production release.

- [ ] **Step 6: Complete high-fidelity physical-device acceptance**

Run the full P0 flow on at least one iOS device and one Android device. On each device verify readable layout, tap targets, continuous drag feedback, route switching, intro skip, all event transitions, 8-second warning, 15-second/error fallback, result restart/home, and no score/authority/commercial claims. Repeat one run under weak-network conditions and confirm queued events later flush in order.

- [ ] **Step 7: Verify analytics and security evidence**

Query `behavior_events` from the CloudBase console and match one complete session to the expected event sequence without any raw OpenID or personal data. Attempt prohibited client reads/writes and record that configuration/content mutation, event read, event update, and event delete are denied.

- [ ] **Step 8: Run final repository verification and commit records**

```powershell
& 'C:\Users\Andrew\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test
git diff --check
git status --short
git add docs/testing/P0验收记录.md docs/deployment/P0体验版发布记录.md
git commit -m "test: record P0 trial acceptance"
```

Expected: automated tests PASS, both device records are complete, release record identifies the uploaded trial version, and no local identifier or secret appears in the commit.

- [ ] **Step 9: Push the verified branch**

```powershell
git push -u origin HEAD
```

Expected: the verified implementation and acceptance records are available in the linked Gitee repository; the online artifact remains a WeChat experience version, not a public release.

## Completion Criteria

- All 11 tasks are committed in small, reviewable commits and `node --test` passes from the repository root.
- The exact V1.1 disclaimer, dual candidate routes, three-step experience, event contract, privacy boundary, CloudBase permissions, and 8/15-second degradation policy are covered by automated tests.
- The experience version can be opened by authorized testers through a WeChat QR code.
- One iOS and one Android acceptance record demonstrate the high-fidelity flow, including weak-network recovery.
- No real craft facts, personal data, credentials, production publication, payment, public sign-up, or client-side content approval is introduced.
