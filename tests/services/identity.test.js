const test = require('node:test');
const assert = require('node:assert/strict');

const identityModulePath = '../../miniprogram/services/identity';
const VALID_ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;

function createStorage(initialValue) {
  const values = new Map();
  const writes = [];
  if (initialValue !== undefined) values.set('goldFoilAnonymousId', initialValue);

  return {
    storage: {
      get: (key) => values.get(key),
      set: (key, value) => {
        writes.push([key, value]);
        values.set(key, value);
      },
    },
    writes,
    read: (key) => values.get(key),
  };
}

test('loads the cached opaque anonymous ID without a cloud call', async () => {
  const { createIdentityService } = require(identityModulePath);
  const fixture = createStorage(VALID_ANONYMOUS_ID);
  let cloudCalls = 0;
  const service = createIdentityService({
    storage: fixture.storage,
    cloudCall: () => {
      cloudCalls += 1;
      throw new Error('cloud should not be called');
    },
    idFactory: () => 'unused',
  });

  assert.equal(await service.getAnonymousId(), VALID_ANONYMOUS_ID);
  assert.equal(cloudCalls, 0);
  assert.deepEqual(fixture.writes, []);
});

test('bootstraps once on a cache miss and persists only the returned opaque ID', async () => {
  const { createIdentityService } = require(identityModulePath);
  const fixture = createStorage();
  const cloudCalls = [];
  const service = createIdentityService({
    storage: fixture.storage,
    cloudCall: async (...args) => {
      cloudCalls.push(args);
      return { anonymousId: VALID_ANONYMOUS_ID };
    },
    idFactory: () => 'unused',
  });

  assert.equal(await service.getAnonymousId(), VALID_ANONYMOUS_ID);
  assert.equal(await service.getAnonymousId(), VALID_ANONYMOUS_ID);
  assert.deepEqual(cloudCalls, [['bootstrapAnonymousId']]);
  assert.deepEqual(fixture.writes, [['goldFoilAnonymousId', VALID_ANONYMOUS_ID]]);
  assert.equal(fixture.read('goldFoilAnonymousId'), VALID_ANONYMOUS_ID);
});

test('coalesces concurrent cache misses into one bootstrap call', async () => {
  const { createIdentityService } = require(identityModulePath);
  const fixture = createStorage();
  let cloudCalls = 0;
  let resolveBootstrap;
  const bootstrap = new Promise((resolve) => {
    resolveBootstrap = resolve;
  });
  const service = createIdentityService({
    storage: fixture.storage,
    cloudCall: () => {
      cloudCalls += 1;
      return bootstrap;
    },
    idFactory: () => 'unused',
  });

  const first = service.getAnonymousId();
  const second = service.getAnonymousId();
  resolveBootstrap({ anonymousId: VALID_ANONYMOUS_ID });

  assert.deepEqual(await Promise.all([first, second]), [VALID_ANONYMOUS_ID, VALID_ANONYMOUS_ID]);
  assert.equal(cloudCalls, 1);
  assert.deepEqual(fixture.writes, [['goldFoilAnonymousId', VALID_ANONYMOUS_ID]]);
});

test('rejects caller-supplied platform identifiers without reading or persisting them', async () => {
  const { createIdentityService } = require(identityModulePath);
  const fixture = createStorage();
  let cloudCalls = 0;
  const service = createIdentityService({
    storage: fixture.storage,
    cloudCall: () => {
      cloudCalls += 1;
      return { anonymousId: VALID_ANONYMOUS_ID };
    },
    idFactory: () => 'unused',
  });

  await assert.rejects(
    service.getAnonymousId({ openid: 'fictional-openid-must-be-rejected' }),
    /caller input is not accepted/,
  );
  await assert.rejects(
    service.getAnonymousId({ unionid: 'fictional-unionid-must-be-rejected' }),
    /caller input is not accepted/,
  );
  assert.equal(cloudCalls, 0);
  assert.deepEqual(fixture.writes, []);
});

test('does not cache or return malformed and raw platform identifiers from bootstrap', async () => {
  const { createIdentityService } = require(identityModulePath);
  const hiddenPlatformIdentifier = { anonymousId: VALID_ANONYMOUS_ID };
  Object.defineProperty(hiddenPlatformIdentifier, '_openid', {
    value: 'fictional-openid-must-be-rejected',
    enumerable: false,
  });

  for (const response of [
    { anonymousId: 'not-opaque' },
    { anonymousId: VALID_ANONYMOUS_ID, openid: 'fictional-openid-must-be-rejected' },
    { anonymousId: VALID_ANONYMOUS_ID, _openid: 'fictional-openid-must-be-rejected' },
    { anonymousId: VALID_ANONYMOUS_ID, open_id: 'fictional-openid-must-be-rejected' },
    { anonymousId: VALID_ANONYMOUS_ID, email: 'nobody@example.invalid' },
    { anonymousId: VALID_ANONYMOUS_ID, phone: '000-0000-0000' },
    { anonymousId: VALID_ANONYMOUS_ID, requestId: 'fictional-extra-field' },
    hiddenPlatformIdentifier,
    {
      anonymousId: VALID_ANONYMOUS_ID,
      platform: { unionid: 'fictional-unionid-must-be-rejected' },
    },
    { openid: 'fictional-openid-must-be-rejected' },
    VALID_ANONYMOUS_ID,
  ]) {
    const fixture = createStorage();
    const service = createIdentityService({
      storage: fixture.storage,
      cloudCall: () => response,
      idFactory: () => 'unused',
    });

    await assert.rejects(service.getAnonymousId(), /invalid anonymous identity response/);
    assert.deepEqual(fixture.writes, []);
  }
});

test('creates a fresh session-prefixed ID for every experience', () => {
  const { createIdentityService } = require(identityModulePath);
  const generated = ['abcdef0123456789', '0123456789abcdef'];
  const service = createIdentityService({
    storage: createStorage(VALID_ANONYMOUS_ID).storage,
    cloudCall: () => {
      throw new Error('unused');
    },
    idFactory: () => generated.shift(),
  });

  assert.equal(service.createSessionId(), 'session_abcdef0123456789');
  assert.equal(service.createSessionId(), 'session_0123456789abcdef');
});

test('rejects invalid and duplicate raw session ID factory values', () => {
  const { createIdentityService } = require(identityModulePath);

  for (const rawId of ['', undefined, 'undefined', 'short', 'ABCDEF0123456789', 'a'.repeat(65)]) {
    const service = createIdentityService({
      storage: createStorage(VALID_ANONYMOUS_ID).storage,
      cloudCall: () => {
        throw new Error('unused');
      },
      idFactory: () => rawId,
    });
    assert.throws(() => service.createSessionId(), /invalid session id/);
  }

  const service = createIdentityService({
    storage: createStorage(VALID_ANONYMOUS_ID).storage,
    cloudCall: () => {
      throw new Error('unused');
    },
    idFactory: () => 'abcdef0123456789',
  });
  assert.equal(service.createSessionId(), 'session_abcdef0123456789');
  assert.throws(() => service.createSessionId(), /duplicate session id/);
});
