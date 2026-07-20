'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBootstrapAnonymousIdHandler } = require('../../cloudfunctions/bootstrapAnonymousId/lib/handler');
const { createConfirmRouteHandler } = require('../../cloudfunctions/confirmRoute/lib/handler');
const { createSubmitBehaviorEventHandler } = require('../../cloudfunctions/submitBehaviorEvent/lib/handler');

const ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;

function validEvent(overrides = {}) {
  return {
    eventId: 'event_abcdef0123456789',
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_abcdef0123456789',
    routeId: 'foil_making_candidate',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    source: 'test',
    delivery: 'at-least-once',
    name: 'home_cta_click',
    occurredAt: '2026-07-20T01:02:03.000Z',
    properties: {},
    ...overrides,
  };
}

test('bootstrap uses only trusted context and returns the exact anonymous identity object', async () => {
  const hashCalls = [];
  const handler = createBootstrapAnonymousIdHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid', UNIONID: 'must-be-ignored' }),
    environment: { ANONYMIZATION_SALT: 'trial-salt' },
    hashIdentity: (...args) => {
      hashCalls.push(args);
      return ANONYMOUS_ID;
    },
  });

  assert.deepEqual(await handler({}), { anonymousId: ANONYMOUS_ID });
  assert.deepEqual(hashCalls, [['trusted-openid', 'trial-salt']]);
  await assert.rejects(handler({ openid: 'caller-openid' }), /request/i);
  await assert.rejects(handler({ arbitrary: true }), /request/i);
});

test('confirmRoute authorizes the trusted caller and writes only a bounded trial config', async () => {
  const writes = [];
  const database = {
    collection(name) {
      if (name === 'content_items') {
        return {
          doc: (id) => ({
            get: async () => ({
              data: {
                _id: id,
                routeId: 'foil_making_candidate',
                allowedEnvironment: 'trial',
                reviewStatus: 'reviewed',
              },
            }),
          }),
        };
      }
      assert.equal(name, 'app_config');
      return {
        doc: (id) => ({
          set: async ({ data }) => writes.push([id, data]),
        }),
      };
    },
  };
  const handler = createConfirmRouteHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid' }),
    environment: {
      ANONYMIZATION_SALT: 'trial-salt',
      APPROVER_IDS: `${ANONYMOUS_ID},anon_${'b'.repeat(32)}`,
    },
    hashIdentity: () => ANONYMOUS_ID,
    database,
  });

  assert.deepEqual(await handler({
    routeId: 'foil_making_candidate',
    contentItemId: 'content-foil-making',
  }), { confirmed: true });
  assert.deepEqual(writes, [[
    'foil_making_candidate',
    {
      routeId: 'foil_making_candidate',
      contentItemId: 'content-foil-making',
      allowedEnvironment: 'trial',
      reviewStatus: 'reviewed',
    },
  ]]);
});

test('confirmRoute fails closed before database access for untrusted or open requests', async () => {
  let databaseReads = 0;
  const database = {
    collection() {
      databaseReads += 1;
      throw new Error('must not access database');
    },
  };
  const createHandler = (overrides = {}) => createConfirmRouteHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid' }),
    environment: { ANONYMIZATION_SALT: 'trial-salt', APPROVER_IDS: '' },
    hashIdentity: () => ANONYMOUS_ID,
    database,
    ...overrides,
  });

  await assert.rejects(
    createHandler()({ routeId: 'foil_making_candidate', contentItemId: 'content', production: false }),
    /request/i,
  );
  await assert.rejects(
    createHandler()({ routeId: 'foil_making_candidate', contentItemId: 'content' }),
    /authorized/i,
  );
  await assert.rejects(
    createHandler({ getWXContext: () => ({}) })({
      routeId: 'foil_making_candidate',
      contentItemId: 'content',
    }),
    /mini-program context/i,
  );
  assert.equal(databaseReads, 0);
});

test('confirmRoute rejects request accessors without invoking them', async () => {
  let getterReads = 0;
  let databaseReads = 0;
  const request = { routeId: 'foil_making_candidate' };
  Object.defineProperty(request, 'contentItemId', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'content-foil-making';
    },
  });
  const handler = createConfirmRouteHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid' }),
    environment: { ANONYMIZATION_SALT: 'trial-salt', APPROVER_IDS: ANONYMOUS_ID },
    hashIdentity: () => ANONYMOUS_ID,
    database: {
      collection() {
        databaseReads += 1;
        throw new Error('must not access database');
      },
    },
  });

  await assert.rejects(handler(request), /request|candidate/i);
  assert.equal(getterReads, 0);
  assert.equal(databaseReads, 0);
});

test('submitBehaviorEvent binds the anonymous envelope to trusted OPENID before persistence', async () => {
  const submissions = [];
  const hashCalls = [];
  const handler = createSubmitBehaviorEventHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid', UNIONID: 'must-be-ignored' }),
    environment: { ANONYMIZATION_SALT: 'trial-salt' },
    hashIdentity: (...args) => {
      hashCalls.push(args);
      return ANONYMOUS_ID;
    },
    validateEventEnvelope: (event) => Object.freeze({ ...event }),
    store: {
      submit: async (event) => {
        submissions.push(event);
        return { acknowledged: true };
      },
    },
  });
  const event = validEvent();

  assert.deepEqual(await handler(event), { acknowledged: true });
  assert.deepEqual(hashCalls, [['trusted-openid', 'trial-salt']]);
  assert.deepEqual(submissions, [event]);
});

test('submitBehaviorEvent rejects caller identity conflicts and non-mini-program contexts', async () => {
  let submitCalls = 0;
  const createHandler = (overrides = {}) => createSubmitBehaviorEventHandler({
    getWXContext: () => ({ OPENID: 'trusted-openid' }),
    environment: { ANONYMIZATION_SALT: 'trial-salt' },
    hashIdentity: () => ANONYMOUS_ID,
    validateEventEnvelope: (event) => event,
    store: { submit: async () => { submitCalls += 1; } },
    ...overrides,
  });

  await assert.rejects(
    createHandler()(validEvent({ anonymousId: `anon_${'b'.repeat(32)}` })),
    /identity/i,
  );
  await assert.rejects(
    createHandler({ getWXContext: () => ({ OPENID: '' }) })(validEvent()),
    /mini-program context/i,
  );
  assert.equal(submitCalls, 0);
});
