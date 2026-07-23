'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.resolve(__dirname, '../..');
const functionNames = ['bootstrapAnonymousId', 'confirmRoute', 'submitBehaviorEvent'];

function loadIndexWithCloud(functionName, cloud, moduleOverrides = {}) {
  const indexPath = path.join(root, 'cloudfunctions', functionName, 'index.js');
  const resolved = require.resolve(indexPath);
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloud;
    if (Object.hasOwn(moduleOverrides, request)) return moduleOverrides[request];
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

test('adapts only CloudBase-injected userInfo before strict request validation', () => {
  const handlerFactories = {
    bootstrapAnonymousId: 'createBootstrapAnonymousIdHandler',
    confirmRoute: 'createConfirmRouteHandler',
    submitBehaviorEvent: 'createSubmitBehaviorEventHandler',
  };
  const adapterBuffers = [];
  for (const functionName of functionNames) {
    const adapterPath = path.join(
      root,
      'cloudfunctions',
      functionName,
      'lib',
      'cloudbase-request.js',
    );
    assert.ok(fs.existsSync(adapterPath), `${functionName} request adapter is missing`);

    const { adaptCloudBaseRequest } = require(adapterPath);
    const businessValue = Object.freeze({ routeId: 'foil_making_candidate' });
    const injected = {
      businessValue,
      userInfo: Object.freeze({ platformMetadata: true }),
    };
    const adapted = adaptCloudBaseRequest(injected);

    assert.deepEqual(adapted, { businessValue }, functionName);
    assert.equal(adapted.businessValue, businessValue, functionName);
    assert.deepEqual(
      adaptCloudBaseRequest({ userInfo: {}, arbitrary: true }),
      { arbitrary: true },
      functionName,
    );

    let metadataReads = 0;
    const accessorMetadata = {};
    Object.defineProperty(accessorMetadata, 'userInfo', {
      enumerable: true,
      get() {
        metadataReads += 1;
        return {};
      },
    });
    assert.throws(() => adaptCloudBaseRequest(accessorMetadata), /metadata/i, functionName);
    assert.equal(metadataReads, 0, functionName);

    const received = [];
    const factoryName = handlerFactories[functionName];
    const cloud = {
      DYNAMIC_CURRENT_ENV: Symbol('dynamic-current-env'),
      init: () => undefined,
      getWXContext: () => ({}),
      database: () => ({
        runTransaction: () => undefined,
        serverDate: () => ({ $date: 'server' }),
      }),
    };
    const loaded = loadIndexWithCloud(functionName, cloud, {
      './lib/handler': {
        [factoryName]: () => (event) => {
          received.push(event);
          return { handled: true };
        },
      },
    });

    assert.deepEqual(
      loaded.main({ userInfo: { platformMetadata: true }, arbitrary: true }),
      { handled: true },
      functionName,
    );
    assert.deepEqual(received, [{ arbitrary: true }], functionName);

    const callsBeforeAccessor = received.length;
    assert.throws(() => loaded.main(accessorMetadata), /metadata/i, functionName);
    assert.equal(metadataReads, 0, functionName);
    assert.equal(received.length, callsBeforeAccessor, functionName);

    adapterBuffers.push(fs.readFileSync(adapterPath));
  }
  assert.ok(
    adapterBuffers.slice(1).every((buffer) => buffer.equals(adapterBuffers[0])),
    'request adapters must stay byte-identical',
  );
});

test('bootstrap shell ignores platform metadata but rejects other caller fields', async () => {
  const previousSalt = process.env.ANONYMIZATION_SALT;
  const previousAppId = process.env.WECHAT_APP_ID;
  const expectedAppId = `wx${'a'.repeat(16)}`;
  process.env.ANONYMIZATION_SALT = 's'.repeat(32);
  process.env.WECHAT_APP_ID = expectedAppId;

  try {
    const cloud = {
      DYNAMIC_CURRENT_ENV: Symbol('dynamic-current-env'),
      init: () => undefined,
      getWXContext: () => ({ OPENID: 'trusted-openid', APPID: expectedAppId }),
    };
    const loaded = loadIndexWithCloud('bootstrapAnonymousId', cloud);

    const result = await loaded.main({ userInfo: { platformMetadata: true } });
    assert.match(result.anonymousId, /^anon_[a-f0-9]{32}$/);
    await assert.rejects(
      loaded.main({ userInfo: {}, arbitrary: true }),
      /request/i,
    );
  } finally {
    if (previousSalt === undefined) delete process.env.ANONYMIZATION_SALT;
    else process.env.ANONYMIZATION_SALT = previousSalt;
    if (previousAppId === undefined) delete process.env.WECHAT_APP_ID;
    else process.env.WECHAT_APP_ID = previousAppId;
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
