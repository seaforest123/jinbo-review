'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '../..');
const functionNames = ['bootstrapAnonymousId', 'confirmRoute', 'submitBehaviorEvent'];

function loadIndexWithCloud(functionName, cloud) {
  const indexPath = path.join(root, 'cloudfunctions', functionName, 'index.js');
  const resolved = require.resolve(indexPath);
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloud;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[resolved];
    return require(resolved);
  } finally {
    delete require.cache[resolved];
    Module._load = originalLoad;
  }
}

test('pins every independently deployed function to wx-server-sdk 3.0.1', () => {
  for (const functionName of functionNames) {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(root, 'cloudfunctions', functionName, 'package.json'),
      'utf8',
    ));
    assert.equal(manifest.main, 'index.js', functionName);
    assert.deepEqual(manifest.dependencies, { 'wx-server-sdk': '3.0.1' }, functionName);
  }
});

test('keeps each SDK index as an initialized injectable thin shell', () => {
  for (const functionName of functionNames) {
    const initCalls = [];
    const cloud = {
      DYNAMIC_CURRENT_ENV: Symbol('dynamic-current-env'),
      init: (options) => initCalls.push(options),
      getWXContext: () => ({ OPENID: 'trusted-openid' }),
      database: () => ({
        collection: () => ({ doc: () => ({}) }),
        runTransaction: () => undefined,
        serverDate: () => ({ $date: 'server' }),
      }),
    };
    const loaded = loadIndexWithCloud(functionName, cloud);

    assert.equal(typeof loaded.main, 'function', functionName);
    assert.deepEqual(initCalls, [{ env: cloud.DYNAMIC_CURRENT_ENV }], functionName);
  }
});

test('production shells inject server time and closed-schema validation into transactional services', () => {
  const confirmSource = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'confirmRoute', 'index.js'),
    'utf8',
  );
  const submitSource = fs.readFileSync(
    path.join(root, 'cloudfunctions', 'submitBehaviorEvent', 'index.js'),
    'utf8',
  );

  assert.match(confirmSource, /serverDate:\s*\(\)\s*=>\s*database\.serverDate\(\)/);
  assert.match(
    submitSource,
    /createBehaviorEventStore\(\{\s*database,\s*validateEventEnvelope,?\s*\}\)/,
  );
});

test('contains no logging, UNIONID use, or raw identity persistence fields', () => {
  for (const functionName of functionNames) {
    const directory = path.join(root, 'cloudfunctions', functionName);
    const files = fs.readdirSync(directory, { recursive: true })
      .filter((file) => file.endsWith('.js'));
    for (const file of files) {
      const source = fs.readFileSync(path.join(directory, file), 'utf8');
      assert.doesNotMatch(source, /console\s*\./, `${functionName}/${file}`);
      assert.doesNotMatch(source, /UNIONID/, `${functionName}/${file}`);
      assert.doesNotMatch(source, /[_\"']openid[\"']?\s*:/i, `${functionName}/${file}`);
    }
  }
});
