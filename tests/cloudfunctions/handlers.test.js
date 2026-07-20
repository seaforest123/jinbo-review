'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBootstrapAnonymousIdHandler } = require('../../cloudfunctions/bootstrapAnonymousId/lib/handler');
const { createConfirmRouteHandler } = require('../../cloudfunctions/confirmRoute/lib/handler');
const { createSubmitBehaviorEventHandler } = require('../../cloudfunctions/submitBehaviorEvent/lib/handler');
const { validateRoute } = require('../../miniprogram/domain/route-config');
const { createContentRepository } = require('../../miniprogram/services/content-repository');

const ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;
const OTHER_ANONYMOUS_ID = `anon_${'b'.repeat(32)}`;
const APP_ID = `wx${'a'.repeat(16)}`;
const STRONG_SALT = 's'.repeat(32);
const SERVER_DATE = Object.freeze({ $date: 'server' });

function environment(overrides = {}) {
  return {
    ANONYMIZATION_SALT: STRONG_SALT,
    WECHAT_APP_ID: APP_ID,
    APPROVER_IDS: `${ANONYMOUS_ID},${OTHER_ANONYMOUS_ID}`,
    ...overrides,
  };
}

function trustedContext(overrides = {}) {
  return { OPENID: 'trusted-openid', APPID: APP_ID, ...overrides };
}

function reviewedContent(overrides = {}) {
  return {
    _id: 'content-foil-making',
    routeId: 'foil_making_candidate',
    contentVersion: 'content-v2',
    allowedEnvironment: 'trial',
    reviewStatus: 'reviewed',
    ...overrides,
  };
}

function candidateRoute(overrides = {}) {
  return {
    _id: 'foil_making_candidate',
    id: 'foil_making_candidate',
    displayName: '制箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
    banner: '候选示意，尚未经专业确认',
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
    ],
    ...overrides,
  };
}

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

function createConfirmDatabase({
  contentItem = reviewedContent(),
  routeDocument = candidateRoute(),
  rejectCommit = false,
} = {}) {
  const committed = new Map();
  if (routeDocument) committed.set(routeDocument._id || routeDocument.id, routeDocument);
  const calls = {
    directCollections: 0,
    transactions: 0,
    contentReads: 0,
    routeReads: 0,
    stagedWrites: 0,
    commits: 0,
    order: [],
  };
  const database = {
    collection() {
      calls.directCollections += 1;
      throw new Error('confirmRoute must stay inside runTransaction');
    },
    async runTransaction(operation) {
      calls.transactions += 1;
      calls.order.push('transaction:start');
      const staged = new Map(committed);
      const transaction = {
        collection(name) {
          assert.ok(['content_items', 'app_config'].includes(name));
          return {
            doc(id) {
              if (name === 'content_items') {
                return {
                  async get() {
                    calls.contentReads += 1;
                    calls.order.push('content:read');
                    return { data: id === contentItem._id ? contentItem : null };
                  },
                };
              }
              return {
                async get() {
                  calls.routeReads += 1;
                  calls.order.push('config:read');
                  return { data: staged.get(id) || null };
                },
                async set({ data }) {
                  calls.stagedWrites += 1;
                  calls.order.push('config:write');
                  staged.set(id, data);
                },
              };
            },
          };
        },
      };
      const result = await operation(transaction);
      if (rejectCommit) throw new Error('simulated transaction commit conflict');
      committed.clear();
      for (const [key, value] of staged) committed.set(key, value);
      calls.commits += 1;
      calls.order.push('transaction:commit');
      return result;
    },
  };
  return { database, committed, calls };
}

test('bootstrap uses only trusted context and returns the exact anonymous identity object', async () => {
  const hashCalls = [];
  const handler = createBootstrapAnonymousIdHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: (...args) => {
      hashCalls.push(args);
      return ANONYMOUS_ID;
    },
  });

  assert.deepEqual(await handler({}), { anonymousId: ANONYMOUS_ID });
  assert.deepEqual(hashCalls, [['trusted-openid', STRONG_SALT]]);
  await assert.rejects(handler({ openid: 'caller-openid' }), /request/i);
  await assert.rejects(handler({ arbitrary: true }), /request/i);
});

test('confirmRoute re-reads and writes versioned auditable config in one transaction', async () => {
  const fixture = createConfirmDatabase({
    contentItem: reviewedContent({ contentVersion: 'content-v2' }),
  });
  const serverDateCalls = [];
  const handler = createConfirmRouteHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    database: fixture.database,
    serverDate: () => {
      serverDateCalls.push('called');
      fixture.calls.order.push('server:date');
      return SERVER_DATE;
    },
  });

  assert.deepEqual(await handler({
    routeId: 'foil_making_candidate',
    contentItemId: 'content-foil-making',
  }), { confirmed: true });
  const storedRoute = fixture.committed.get('foil_making_candidate');
  assert.deepEqual(storedRoute, {
    id: 'foil_making_candidate',
    displayName: '制箔候选路线',
    status: 'confirmed',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
    banner: '候选示意，尚未经专业确认',
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
    ],
    contentItemId: 'content-foil-making',
    contentVersion: 'content-v2',
    approvalAudit: {
      reviewerAnonymousId: ANONYMOUS_ID,
      approvedAt: SERVER_DATE,
      contentItemId: 'content-foil-making',
      contentVersion: 'content-v2',
    },
  });
  assert.equal(validateRoute(storedRoute).status, 'confirmed');
  const repository = createContentRepository({
    database: {
      command: { in: (values) => ({ in: values }) },
      collection(name) {
        assert.equal(name, 'app_config');
        return {
          where(query) {
            assert.deepEqual(query, {
              allowedEnvironment: 'trial',
              reviewStatus: { in: ['internal_approved'] },
            });
            return { get: async () => ({ data: [storedRoute] }) };
          },
        };
      },
    },
    localRoutes: [],
  });
  assert.deepEqual(await repository.loadRoutes('trial'), [storedRoute]);
  assert.deepEqual(fixture.calls.order, [
    'transaction:start',
    'content:read',
    'config:read',
    'server:date',
    'config:write',
    'transaction:commit',
  ]);
  assert.equal(serverDateCalls.length, 1);
  assert.equal(fixture.calls.directCollections, 0);
  assert.equal(fixture.calls.transactions, 1);
  assert.equal(fixture.calls.contentReads, 1);
  assert.equal(fixture.calls.routeReads, 1);
  assert.equal(fixture.calls.commits, 1);
});

test('confirmRoute ignores a stale outside snapshot and uses the transactional content version', async () => {
  let directCollections = 0;
  const committed = new Map();
  const stale = reviewedContent({ contentVersion: 'content-v1' });
  const current = reviewedContent({ contentVersion: 'content-v2' });
  const staleRoute = candidateRoute({ displayName: '事务外旧路线' });
  const currentRoute = candidateRoute({ displayName: '事务内当前路线' });
  const database = {
    collection(name) {
      directCollections += 1;
      if (name === 'content_items') {
        return { doc: () => ({ get: async () => ({ data: stale }) }) };
      }
      return {
        doc: (id) => ({
          get: async () => ({ data: staleRoute }),
          set: async ({ data }) => committed.set(id, data),
        }),
      };
    },
    async runTransaction(operation) {
      const transaction = {
        collection(name) {
          return {
            doc(id) {
              if (name === 'content_items') {
                return { get: async () => ({ data: id === current._id ? current : null }) };
              }
              return {
                get: async () => ({ data: id === currentRoute._id ? currentRoute : null }),
                set: async ({ data }) => committed.set(id, data),
              };
            },
          };
        },
      };
      return operation(transaction);
    },
  };
  const handler = createConfirmRouteHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    database,
    serverDate: () => SERVER_DATE,
  });

  await handler({ routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' });
  assert.equal(directCollections, 0);
  assert.equal(committed.get('foil_making_candidate').displayName, '事务内当前路线');
  assert.equal(committed.get('foil_making_candidate').contentVersion, 'content-v2');
  assert.equal(
    committed.get('foil_making_candidate').approvalAudit.contentVersion,
    'content-v2',
  );
});

test('confirmRoute rolls back route and embedded audit when transaction commit fails', async () => {
  const fixture = createConfirmDatabase({ rejectCommit: true });
  const handler = createConfirmRouteHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    database: fixture.database,
    serverDate: () => SERVER_DATE,
  });

  await assert.rejects(handler({
    routeId: 'foil_making_candidate',
    contentItemId: 'content-foil-making',
  }), /commit conflict/i);
  assert.equal(fixture.calls.stagedWrites, 1);
  assert.equal(fixture.calls.commits, 0);
  assert.deepEqual(fixture.committed.get('foil_making_candidate'), candidateRoute());
});

test('confirmRoute fails closed and rolls back for missing, malformed, or wrong route config', async () => {
  const badRoutes = [
    null,
    candidateRoute({ _id: 'foil_application_candidate' }),
    candidateRoute({ id: 'foil_application_candidate' }),
    candidateRoute({ status: 'confirmed' }),
    candidateRoute({ steps: [] }),
  ];

  for (const routeDocument of badRoutes) {
    const fixture = createConfirmDatabase({ routeDocument });
    const handler = createConfirmRouteHandler({
      getWXContext: () => trustedContext(),
      environment: environment(),
      hashIdentity: () => ANONYMOUS_ID,
      database: fixture.database,
      serverDate: () => SERVER_DATE,
    });

    await assert.rejects(
      handler({ routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' }),
      /route|config|placeholder/i,
    );
    assert.equal(fixture.calls.contentReads, 1);
    assert.equal(fixture.calls.routeReads, 1);
    assert.equal(fixture.calls.stagedWrites, 0);
    assert.equal(fixture.calls.commits, 0);
  }
});

test('confirmRoute fails closed before a transaction for open, unauthorized, or invalid requests', async () => {
  const fixture = createConfirmDatabase();
  const createHandler = (overrides = {}) => createConfirmRouteHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    database: fixture.database,
    serverDate: () => SERVER_DATE,
    ...overrides,
  });

  await assert.rejects(
    createHandler()({ routeId: 'foil_making_candidate', contentItemId: 'content', production: false }),
    /request/i,
  );
  await assert.rejects(
    createHandler({ hashIdentity: () => `anon_${'c'.repeat(32)}` })({
      routeId: 'foil_making_candidate',
      contentItemId: 'content',
    }),
    /authorized/i,
  );
  await assert.rejects(
    createHandler({ environment: environment({ APPROVER_IDS: '' }) })({
      routeId: 'foil_making_candidate',
      contentItemId: 'content',
    }),
    /APPROVER_IDS|reviewer/i,
  );
  assert.equal(fixture.calls.transactions, 0);
});

test('confirmRoute rejects request accessors without invoking them', async () => {
  let getterReads = 0;
  const fixture = createConfirmDatabase();
  const request = { routeId: 'foil_making_candidate' };
  Object.defineProperty(request, 'contentItemId', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'content-foil-making';
    },
  });
  const handler = createConfirmRouteHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    database: fixture.database,
    serverDate: () => SERVER_DATE,
  });

  await assert.rejects(handler(request), /request|candidate/i);
  assert.equal(getterReads, 0);
  assert.equal(fixture.calls.transactions, 0);
});

test('submitBehaviorEvent binds the anonymous envelope to trusted OPENID before persistence', async () => {
  const submissions = [];
  const hashCalls = [];
  const handler = createSubmitBehaviorEventHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
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
  assert.deepEqual(hashCalls, [['trusted-openid', STRONG_SALT]]);
  assert.deepEqual(submissions, [event]);
});

test('all handlers reject missing or mismatched trusted APPID before side effects', async () => {
  for (const context of [
    { OPENID: 'trusted-openid' },
    trustedContext({ APPID: `wx${'b'.repeat(16)}` }),
  ]) {
    let hashCalls = 0;
    let submitCalls = 0;
    const hashIdentity = () => {
      hashCalls += 1;
      return ANONYMOUS_ID;
    };
    const fixture = createConfirmDatabase();
    const bootstrap = createBootstrapAnonymousIdHandler({
      getWXContext: () => context,
      environment: environment(),
      hashIdentity,
    });
    const confirm = createConfirmRouteHandler({
      getWXContext: () => context,
      environment: environment(),
      hashIdentity,
      database: fixture.database,
      serverDate: () => SERVER_DATE,
    });
    const submit = createSubmitBehaviorEventHandler({
      getWXContext: () => context,
      environment: environment(),
      hashIdentity,
      validateEventEnvelope: (event) => event,
      store: { submit: async () => { submitCalls += 1; } },
    });

    await assert.rejects(bootstrap({}), /APPID|mini-program context/i);
    await assert.rejects(confirm({
      routeId: 'foil_making_candidate',
      contentItemId: 'content-foil-making',
    }), /APPID|mini-program context/i);
    await assert.rejects(submit(validEvent()), /APPID|mini-program context/i);
    assert.equal(hashCalls, 0);
    assert.equal(submitCalls, 0);
    assert.equal(fixture.calls.transactions, 0);
  }
});

test('submitBehaviorEvent rejects caller identity conflicts before persistence', async () => {
  let submitCalls = 0;
  const handler = createSubmitBehaviorEventHandler({
    getWXContext: () => trustedContext(),
    environment: environment(),
    hashIdentity: () => ANONYMOUS_ID,
    validateEventEnvelope: (event) => event,
    store: { submit: async () => { submitCalls += 1; } },
  });

  await assert.rejects(
    handler(validEvent({ anonymousId: OTHER_ANONYMOUS_ID })),
    /identity/i,
  );
  assert.equal(submitCalls, 0);
});
