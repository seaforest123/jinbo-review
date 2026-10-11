'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const localRoutes = require('../../miniprogram/data/routes');
const { validateRoute } = require('../../miniprogram/domain/route-config');

const root = path.resolve(__dirname, '../..');
const seedRoot = path.join(root, 'cloudbase/seed-data');
const expectedFiles = ['app_config.json', 'behavior_events.json', 'content_items.json', 'media_assets.json'];
const forbidden = /openid|unionid|phone|email|appid|environment.?id|salt|approver|@[a-z0-9.-]+/i;

function loadSeed(name) {
  return JSON.parse(fs.readFileSync(path.join(seedRoot, name), 'utf8'));
}

test('ships exactly the four approved offline collection seed files', () => {
  assert.deepEqual(fs.readdirSync(seedRoot).filter((name) => name.endsWith('.json')).sort(), expectedFiles);
});

test('keeps the validated internal candidate route consistent with local configuration', () => {
  const records = loadSeed('app_config.json');
  assert.equal(records.length, 1);
  assert.deepEqual(records.map((record) => record.id).sort(), localRoutes.map((route) => route.id).sort());
  for (const record of records) {
    assert.equal(record.allowedEnvironment, 'trial');
    assert.deepEqual(record.allowedEnvironments, ['development', 'trial']);
    assert.equal(record.status, 'internal_placeholder');
    assert.equal(record.reviewStatus, 'internal_approved');
    const { allowedEnvironment, ...routeFields } = record;
    assert.equal(allowedEnvironment, 'trial');
    assert.deepEqual(validateRoute(routeFields), localRoutes.find((route) => route.id === record.id));
  }
});

test('contains only generic candidate content, local placeholder media, and no event records', () => {
  const content = loadSeed('content_items.json');
  const media = loadSeed('media_assets.json');
  assert.equal(content.length, 1);
  assert.equal(media.length, 1);
  assert.deepEqual(loadSeed('behavior_events.json'), []);
  for (const record of [...content, ...media]) {
    assert.equal(record.allowedEnvironment, 'trial');
    assert.equal(record.reviewStatus, 'internal_approved');
    assert.ok(localRoutes.some((route) => route.id === record.routeId));
    assert.doesNotMatch(JSON.stringify(record), forbidden);
  }
  assert.ok(content.every((record) => !Object.hasOwn(record, 'confirmedRoute')));
  assert.ok(media.every((record) => record.path.startsWith('local://candidate/')));
});

test('replaces the Gitee templates with deployment-boundary project guidance', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const englishReadme = fs.readFileSync(path.join(root, 'README.en.md'), 'utf8');
  const navigation = fs.readFileSync(path.join(root, 'README_项目文件导航.md'), 'utf8');
  for (const document of [readme, englishReadme]) {
    assert.doesNotMatch(document, /Gitee Feature|xxxx|OSCHINA/);
    assert.match(document, /P0/);
    assert.match(document, /npm test/);
    assert.match(document, /CloudBase/);
    assert.match(document, /第 11 项|Task 11/);
  }
  assert.match(readme, /候选.*内测|candidate.*trial/i);
  assert.match(navigation, /cloudbase\/seed-data/);
});
