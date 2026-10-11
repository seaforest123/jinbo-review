'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const rulesRoot = path.join(root, 'cloudbase/database-rules');
const functionRulesPath = path.join(root, 'cloudbase/function-rules.json');
const readRule = "doc.allowedEnvironment == 'trial' && doc.reviewStatus in ['internal_approved', 'reviewed', 'published']";

function loadRule(collection) {
  return JSON.parse(fs.readFileSync(path.join(rulesRoot, `${collection}.json`), 'utf8'));
}

test('denies every behavior_events client operation so only the cloud function can write', () => {
  assert.deepEqual(loadRule('behavior_events'), {
    read: false,
    create: false,
    update: false,
    delete: false,
  });
});

test('keeps exactly the four approved database collection rule files', () => {
  assert.deepEqual(
    fs.readdirSync(rulesRoot).filter((file) => file.endsWith('.json')).sort(),
    ['app_config.json', 'behavior_events.json', 'content_items.json', 'media_assets.json'],
  );
});

test('deploys default-deny function invoke rules with only the three explicit client entries', () => {
  const authenticatedInvoke = "auth.loginType != 'ANONYMOUS' && auth != null";
  assert.deepEqual(JSON.parse(fs.readFileSync(functionRulesPath, 'utf8')), {
    '*': { invoke: false },
    bootstrapAnonymousId: { invoke: authenticatedInvoke },
    confirmRoute: { invoke: authenticatedInvoke },
    submitBehaviorEvent: { invoke: authenticatedInvoke },
  });
});

test('allows reviewed trial reads but no client writes for content or configuration', () => {
  for (const collection of ['app_config', 'content_items', 'media_assets']) {
    assert.deepEqual(loadRule(collection), { read: readRule, write: false }, collection);
  }
});

test('contains no wildcard or unconditional client write grant', () => {
  for (const collection of ['behavior_events', 'app_config', 'content_items', 'media_assets']) {
    const rule = loadRule(collection);
    for (const [operation, expression] of Object.entries(rule)) {
      if (!/write|create|update|delete/i.test(operation)) continue;
      assert.notEqual(expression, true, `${collection}.${operation}`);
      assert.doesNotMatch(String(expression), /\*|\btrue\b/i, `${collection}.${operation}`);
    }
  }
});

test('documents offline provisioning, deployment, and secret environment variables', () => {
  const readme = fs.readFileSync(path.join(root, 'cloudbase/README.md'), 'utf8');
  for (const required of [
    'app_config',
    'content_items',
    'media_assets',
    'behavior_events',
    'bootstrapAnonymousId',
    'confirmRoute',
    'submitBehaviorEvent',
    'ANONYMIZATION_SALT',
    'WECHAT_APP_ID',
    'APPROVER_IDS',
    'function-rules.json',
    'client read/create/update/delete=false',
    'HTTP',
    '定时触发器',
    '数据库触发器',
    '管理 API',
    '真实 CloudBase 并发',
    '专用 CloudBase 环境',
    'Web SDK',
    '其他客户端',
    '陈旧上下文',
    'confirmedRoute',
    'displayName',
    'banner',
    'steps',
    'https://docs.cloudbase.net/',
  ]) {
    assert.match(readme, new RegExp(required));
  }
  assert.match(readme, /Option A|方案 A/);
  assert.match(readme, /APPID.*WECHAT_APP_ID|WECHAT_APP_ID.*APPID/);
  assert.match(readme, /APPID.*不能.*消除.*陈旧上下文|APPID.*无法.*消除.*陈旧上下文/);
  assert.match(readme, /不得.*Web SDK|禁止.*Web SDK/);
  assert.match(readme, /auth\.loginType != 'ANONYMOUS' && auth != null/);
  assert.match(readme, /confirmedRoute.*content_items|content_items.*confirmedRoute/s);
  assert.ok(
    readme.includes('/^(?:twist|pack|hammer|inspect|finish)$/'),
    'README must document the exact confirmedRoute step ID contract',
  );
  assert.match(readme, /步骤必须恰好五个/);
  assert.match(readme, /同一.*事务|原子/);
  assert.match(readme, /不得.*候选示意|禁止.*候选示意/);
  assert.match(readme, /至少 32|>=\s*32/);
  assert.match(readme, /不能|无法.*区分.*微信小程序|无法.*识别.*微信小程序/);
  assert.doesNotMatch(readme, /anon_[a-f0-9]{32}|\b[a-f0-9]{32,}\b/i);
});
