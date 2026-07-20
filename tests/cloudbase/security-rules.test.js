'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const rulesRoot = path.join(root, 'cloudbase/database-rules');
const readRule = "doc.allowedEnvironment == 'trial' && doc.reviewStatus in ['internal_approved', 'reviewed', 'published']";

function loadRule(collection) {
  return JSON.parse(fs.readFileSync(path.join(rulesRoot, `${collection}.json`), 'utf8'));
}

test('uses the exact create-only behavior event rule', () => {
  assert.deepEqual(loadRule('behavior_events'), {
    read: false,
    create: 'doc._openid == auth.openid',
    update: false,
    delete: false,
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
    'APPROVER_IDS',
    'https://docs.cloudbase.net/',
  ]) {
    assert.match(readme, new RegExp(required));
  }
  assert.doesNotMatch(readme, /anon_[a-f0-9]{32}|\b[a-f0-9]{32,}\b/i);
});
