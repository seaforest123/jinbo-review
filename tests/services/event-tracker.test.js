'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const trackerModulePath = '../../miniprogram/services/event-tracker';
const ANONYMOUS_ID = `anon_${'b'.repeat(32)}`;
const OCCURRED_AT = '2026-07-20T01:02:03.000Z';
const ALLOWED_EVENT_NAMES = [
  'home_cta_click',
  'experience_start',
  'video_play',
  'video_skip',
  'step_start',
  'step_hint',
  'step_retry',
  'step_complete',
  'experience_exit',
  'experience_complete',
  'result_action',
];

function createStorage(initialQueue, { asynchronous = false } = {}) {
  const values = new Map();
  const writes = [];
  if (initialQueue !== undefined) values.set('goldFoilEventQueue', initialQueue);

  const wrap = (value) => (asynchronous ? Promise.resolve(value) : value);
  return {
    storage: {
      get: (key) => wrap(values.get(key)),
      set: (key, value) => {
        writes.push([key, value]);
        values.set(key, value);
        return wrap(undefined);
      },
    },
    writes,
    readQueue: () => values.get('goldFoilEventQueue'),
  };
}

function createContext(overrides = {}) {
  return {
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_abcdef0123456789',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    ...overrides,
  };
}

function createTrackerFixture({
  initialQueue,
  storageAsynchronous = false,
  storageFixture,
  transport = () => true,
  context = createContext(),
  idFactory,
} = {}) {
  const fixture = storageFixture || createStorage(initialQueue, { asynchronous: storageAsynchronous });
  let nextId = 0;
  const { createEventTracker } = require(trackerModulePath);
  const tracker = createEventTracker({
    storage: fixture.storage,
    transport,
    clock: () => new Date(OCCURRED_AT),
    idFactory: idFactory || (() => String(++nextId).padStart(16, '0')),
    context,
  });
  return { tracker, fixture };
}

function createQueuedEvent(index) {
  return {
    eventId: `event_${String(index).padStart(16, '0')}`,
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_abcdef0123456789',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    source: 'test',
    delivery: 'at-least-once',
    name: 'step_start',
    occurredAt: OCCURRED_AT,
    properties: { stepId: `step-${index}` },
  };
}

test('creates a complete immutable event record from test context', async () => {
  const sent = [];
  const context = createContext();
  const properties = { stepId: 'step-1', elapsedMs: 1250, hintCount: 0 };
  const { tracker } = createTrackerFixture({
    context,
    transport: (event) => sent.push(event),
  });

  const tracked = tracker.track('step_start', properties);
  context.deviceCapabilities.xrFrame = true;
  properties.stepId = 'mutated';
  const event = await tracked;

  assert.deepEqual(event, {
    eventId: 'event_0000000000000001',
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_abcdef0123456789',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    source: 'test',
    delivery: 'at-least-once',
    name: 'step_start',
    occurredAt: OCCURRED_AT,
    properties: { stepId: 'step-1', elapsedMs: 1250, hintCount: 0 },
  });
  assert.equal(sent[0], event);
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.deviceCapabilities));
  assert.ok(Object.isFrozen(event.properties));
  assert.throws(() => {
    event.name = 'video_play';
  }, TypeError);
});

test('uses internal_trial normally and test during automated tests', async () => {
  const internal = createTrackerFixture({ context: createContext({ environment: 'trial' }) });
  const automated = createTrackerFixture({ context: createContext({ environment: 'test' }) });

  assert.equal((await internal.tracker.track('home_cta_click', {})).source, 'internal_trial');
  assert.equal((await automated.tracker.track('home_cta_click', {})).source, 'test');
  assert.throws(
    () => createTrackerFixture({ context: createContext({ source: 'internal_trial' }) }),
    /invalid event context/,
  );
});

test('exports and records at-least-once delivery semantics', async () => {
  const { DELIVERY_SEMANTICS } = require(trackerModulePath);
  const { tracker } = createTrackerFixture();

  assert.equal(DELIVERY_SEMANTICS, 'at-least-once');
  assert.equal((await tracker.track('home_cta_click', {})).delivery, DELIVERY_SEMANTICS);
});

test('enforces a closed schema for every context field', () => {
  for (const testAccountTag of ['team', 'teacher', 'invitee', null]) {
    assert.doesNotThrow(() => createTrackerFixture({ context: createContext({ testAccountTag }) }));
  }

  const invalidContexts = [
    createContext({ anonymousId: 'anon_not-opaque' }),
    createContext({ sessionId: 'session_undefined' }),
    createContext({ routeId: 'Fictional Person Address' }),
    createContext({ appVersion: '0.1.0' }),
    createContext({ appVersion: '0.1.0-production' }),
    createContext({ environment: 'production' }),
    createContext({ testAccountTag: 'administrator' }),
    createContext({ deviceCapabilities: { xrFrame: 'false', continuousDrag: true } }),
    createContext({ deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: '6g' } }),
    createContext({ deviceCapabilities: { xrFrame: false, continuousDrag: true, model: 'fictional' } }),
    { ...createContext(), extraContext: true },
  ];

  for (const context of invalidContexts) {
    assert.throws(() => createTrackerFixture({ context }), /invalid event context|invalid device capabilities/);
  }
});

test('rejects non-enumerable fields that bypass ordinary key enumeration', async () => {
  const context = createContext();
  Object.defineProperty(context, 'source', {
    value: 'test',
    enumerable: false,
  });
  assert.throws(() => createTrackerFixture({ context }), /invalid event context/);

  const properties = { action: 'retry' };
  Object.defineProperty(properties, 'openid', {
    value: 'fictional-openid-must-be-rejected',
    enumerable: false,
  });
  const { tracker } = createTrackerFixture();
  await assert.rejects(tracker.track('result_action', properties), /invalid event properties/);
});

test('accepts exactly the eleven specified event names', async () => {
  const { tracker } = createTrackerFixture();

  for (const name of ALLOWED_EVENT_NAMES) {
    assert.equal((await tracker.track(name, {})).name, name);
  }
  for (const name of ['login', 'page_view', 'Home_Cta_Click', '', undefined]) {
    await assert.rejects(tracker.track(name, {}), /event name is not allowed/);
  }
});

test('rejects invalid and duplicate raw event IDs before transport', async () => {
  for (const rawId of ['', undefined, 'undefined', 'short', 'ABCDEF0123456789', {}, 'a'.repeat(65)]) {
    let transportCalls = 0;
    const { tracker } = createTrackerFixture({
      idFactory: () => rawId,
      transport: () => {
        transportCalls += 1;
        return true;
      },
    });
    await assert.rejects(tracker.track('home_cta_click', {}), /invalid event id/);
    assert.equal(transportCalls, 0);
  }

  let transportCalls = 0;
  const { tracker } = createTrackerFixture({
    idFactory: () => 'abcdef0123456789',
    transport: () => {
      transportCalls += 1;
      return true;
    },
  });
  assert.equal((await tracker.track('home_cta_click', {})).eventId, 'event_abcdef0123456789');
  await assert.rejects(tracker.track('home_cta_click', {}), /duplicate event id/);
  assert.equal(transportCalls, 1);
});

test('accepts only explicit scalar property keys', async () => {
  const { tracker } = createTrackerFixture();
  const properties = {
    stepId: 'step-1',
    adapter: 'continuous-drag',
    reason: 'user_exit',
    action: 'retry',
    elapsedMs: 1250,
    hintCount: 2,
    retryCount: 1,
  };

  assert.deepEqual((await tracker.track('experience_exit', properties)).properties, properties);
  for (const invalid of [
    { extra: true },
    { stepId: ['step-1'] },
    { elapsedMs: Number.NaN },
    { action: { type: 'retry' } },
  ]) {
    await assert.rejects(tracker.track('result_action', invalid), /invalid event properties/);
  }
});

test('enforces closed per-field property enums, ID formats, and numeric ranges', async () => {
  const { tracker } = createTrackerFixture();
  const validProperties = {
    stepId: 'observe',
    adapter: 'xr-frame',
    reason: 'capability_unavailable',
    action: 'archive',
    elapsedMs: 86400000,
    hintCount: 100,
    retryCount: 100,
  };
  assert.deepEqual((await tracker.track('result_action', validProperties)).properties, validProperties);

  const invalidProperties = [
    { stepId: 'fictional-person-name' },
    { stepId: '000-0000-0000' },
    { stepId: 'nobody@example.invalid' },
    { adapter: 'xr-frame with free text' },
    { adapter: 'nobody@example.invalid' },
    { reason: 'Fictional Person' },
    { reason: 'fictional_address' },
    { action: '000-0000-0000' },
    { action: '00000000000' },
    { elapsedMs: -1 },
    { elapsedMs: 1.5 },
    { elapsedMs: 86400001 },
    { hintCount: -1 },
    { hintCount: 101 },
    { retryCount: 1.5 },
    { retryCount: 101 },
  ];
  for (const properties of invalidProperties) {
    await assert.rejects(tracker.track('result_action', properties), /invalid event properties/);
  }
});

test('rejects platform identifiers, PII fields, and free-form property text', async () => {
  let transportCalls = 0;
  const { tracker, fixture } = createTrackerFixture({
    transport: () => {
      transportCalls += 1;
    },
  });
  const rejected = [
    { openid: 'fictional-openid-must-be-rejected' },
    { unionid: 'fictional-unionid-must-be-rejected' },
    { phone: '000-0000-0000' },
    { email: 'nobody@example.invalid' },
    { name: 'Fictional Person' },
    { address: 'Fictional Address' },
    { text: 'fictional free form text' },
    { reason: 'fictional free form text' },
    { reason: 'nobody@example.invalid' },
    { action: '00000000000' },
  ];

  for (const properties of rejected) {
    await assert.rejects(tracker.track('result_action', properties), /invalid event properties/);
  }
  assert.equal(transportCalls, 0);
  assert.equal(fixture.readQueue(), undefined);
});

test('queues events in order after synchronous and asynchronous transport failures', async () => {
  let call = 0;
  const { tracker, fixture } = createTrackerFixture({
    storageAsynchronous: true,
    transport: () => {
      call += 1;
      if (call === 1) throw new Error('offline sync');
      return Promise.reject(new Error('offline async'));
    },
  });

  const first = await tracker.track('video_play', { adapter: 'select' });
  const second = await tracker.track('video_skip', { reason: 'user_skip' });

  assert.deepEqual(fixture.readQueue(), [first, second]);
  assert.deepEqual(fixture.writes.map(([key]) => key), [
    'goldFoilEventQueue',
    'goldFoilEventQueue',
  ]);
});

test('requires explicit positive transport acknowledgement', async () => {
  const responses = [
    undefined,
    null,
    {},
    { error: 'not-acknowledged' },
    { acknowledged: true, error: 'conflicting-result' },
    false,
  ];
  const { tracker, fixture } = createTrackerFixture({
    transport: () => responses.shift(),
  });

  const queued = [];
  for (const name of [
    'video_play',
    'video_skip',
    'step_start',
    'step_hint',
    'step_retry',
    'step_complete',
  ]) {
    queued.push(await tracker.track(name, name.startsWith('step_') ? { stepId: 'observe' } : {}));
  }
  assert.deepEqual(fixture.readQueue(), queued);

  const acknowledgedFixture = createTrackerFixture({ transport: () => true });
  await acknowledgedFixture.tracker.track('home_cta_click', {});
  assert.equal(acknowledgedFixture.fixture.readQueue(), undefined);

  const objectAckFixture = createTrackerFixture({ transport: () => ({ acknowledged: true }) });
  await objectAckFixture.tracker.track('home_cta_click', {});
  assert.equal(objectAckFixture.fixture.readQueue(), undefined);
});

test('reuses the stable queued eventId when retrying delivery', async () => {
  const sentIds = [];
  let online = false;
  const { tracker, fixture } = createTrackerFixture({
    transport: (event) => {
      sentIds.push(event.eventId);
      return online;
    },
  });

  const event = await tracker.track('video_play', { adapter: 'select' });
  online = true;
  assert.equal(await tracker.flush(), 1);

  assert.deepEqual(sentIds, [event.eventId, event.eventId]);
  assert.deepEqual(fixture.readQueue(), []);
});

test('does not resend a remotely acknowledged event after local dequeue persistence fails', async () => {
  const queued = createQueuedEvent(1);
  let stored = [queued];
  let failNextSet = true;
  const storage = {
    get: () => stored,
    set: (key, value) => {
      assert.equal(key, 'goldFoilEventQueue');
      if (failNextSet) {
        failNextSet = false;
        throw new Error('local dequeue failed');
      }
      stored = value;
    },
  };
  let transportCalls = 0;
  const fixture = createStorage();
  fixture.storage = storage;
  fixture.readQueue = () => stored;
  const { tracker } = createTrackerFixture({
    storageFixture: fixture,
    transport: () => {
      transportCalls += 1;
      return true;
    },
  });

  await assert.rejects(tracker.flush(), /local dequeue failed/);
  assert.deepEqual(stored, [queued]);
  assert.equal(await tracker.flush(), 1);
  assert.equal(transportCalls, 1);
  assert.deepEqual(stored, []);
});

test('retries only local dequeue before attempting an unacknowledged tail event', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2)];
  let stored = queued;
  let failNextSet = true;
  const storage = {
    get: () => stored,
    set: (key, value) => {
      assert.equal(key, 'goldFoilEventQueue');
      if (failNextSet) {
        failNextSet = false;
        throw new Error('local dequeue failed');
      }
      stored = value;
    },
  };
  const sentIds = [];
  const fixture = createStorage();
  fixture.storage = storage;
  fixture.readQueue = () => stored;
  const { tracker } = createTrackerFixture({
    storageFixture: fixture,
    transport: (event) => {
      sentIds.push(event.eventId);
      return event.eventId === queued[0].eventId;
    },
  });

  await assert.rejects(tracker.flush(), /local dequeue failed/);
  assert.deepEqual(sentIds, [queued[0].eventId, queued[1].eventId]);
  assert.equal(await tracker.flush(), 1);
  assert.deepEqual(sentIds, [queued[0].eventId, queued[1].eventId]);
  assert.deepEqual(stored, [queued[1]]);
});

test('serializes concurrent failed writes without losing or duplicating events', async () => {
  const { tracker, fixture } = createTrackerFixture({
    transport: async () => {
      await Promise.resolve();
      throw new Error('offline');
    },
  });

  const events = await Promise.all([
    tracker.track('step_hint', { stepId: 'step-1' }),
    tracker.track('step_retry', { stepId: 'step-1' }),
  ]);

  assert.deepEqual(fixture.readQueue(), events);
});

test('coordinates failed writes across tracker instances sharing one storage', async () => {
  const fixture = createStorage();
  const first = createTrackerFixture({
    storageFixture: fixture,
    idFactory: () => 'a000000000000001',
    transport: async () => {
      await Promise.resolve();
      throw new Error('offline');
    },
  }).tracker;
  const second = createTrackerFixture({
    storageFixture: fixture,
    idFactory: () => 'b000000000000001',
    transport: async () => {
      await Promise.resolve();
      throw new Error('offline');
    },
  }).tracker;

  const events = await Promise.all([
    first.track('step_hint', { stepId: 'observe' }),
    second.track('step_retry', { stepId: 'observe' }),
  ]);

  assert.deepEqual(fixture.readQueue(), events);
});

test('does not let a flush snapshot delete an event queued by another tracker instance', async () => {
  const fixture = createStorage([createQueuedEvent(1)]);
  let releaseTransport;
  let transportStarted;
  const started = new Promise((resolve) => {
    transportStarted = resolve;
  });
  const release = new Promise((resolve) => {
    releaseTransport = resolve;
  });
  const flushing = createTrackerFixture({
    storageFixture: fixture,
    transport: async () => {
      transportStarted();
      await release;
      return true;
    },
  }).tracker;
  const tracking = createTrackerFixture({
    storageFixture: fixture,
    idFactory: () => 'c000000000000001',
    transport: () => false,
  }).tracker;

  const flushPromise = flushing.flush();
  await started;
  const trackPromise = tracking.track('step_hint', { stepId: 'observe' });
  await Promise.resolve();
  await Promise.resolve();
  releaseTransport();
  const [, queuedEvent] = await Promise.all([flushPromise, trackPromise]);

  assert.deepEqual(fixture.readQueue(), [queuedEvent]);
});

test('flushes at most fifty queued events in FIFO order', async () => {
  const queued = Array.from({ length: 52 }, (_, index) => createQueuedEvent(index + 1));
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: async (event) => {
      sentIds.push(event.eventId);
      return true;
    },
  });

  assert.equal(await tracker.flush(), 50);
  assert.deepEqual(sentIds, queued.slice(0, 50).map((event) => event.eventId));
  assert.deepEqual(fixture.readQueue(), queued.slice(50));
});

test('isolates corrupt records while flushing the first fifty valid events and preserving the tail', async () => {
  const valid = Array.from({ length: 52 }, (_, index) => createQueuedEvent(index + 1));
  const corrupted = { openid: 'fictional-openid-must-be-rejected' };
  const initialQueue = [...valid.slice(0, 10), corrupted, ...valid.slice(10)];
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue,
    transport: (event) => {
      sentIds.push(event.eventId);
      return true;
    },
  });

  assert.equal(await tracker.flush(), 50);
  assert.deepEqual(sentIds, valid.slice(0, 50).map((event) => event.eventId));
  assert.deepEqual(fixture.readQueue(), valid.slice(50));
});

test('failed enqueue removes only corrupt records and preserves existing valid events', async () => {
  const existing = createQueuedEvent(1);
  const corrupted = { email: 'nobody@example.invalid' };
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: [existing, corrupted],
    idFactory: () => 'd000000000000001',
    transport: () => false,
  });

  const queuedEvent = await tracker.track('video_skip', { reason: 'user_skip' });

  assert.deepEqual(fixture.readQueue(), [existing, queuedEvent]);
});

test('flush stops at the first unacknowledged event and removes only confirmed entries', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2), createQueuedEvent(3)];
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: (event) => {
      sentIds.push(event.eventId);
      return event.eventId === 'event_0000000000000002'
        ? { acknowledged: false }
        : { acknowledged: true };
    },
  });

  assert.equal(await tracker.flush(), 1);
  assert.deepEqual(sentIds, ['event_0000000000000001', 'event_0000000000000002']);
  assert.deepEqual(fixture.readQueue(), queued.slice(1));
});

test('flush preserves the failed item and later items after an asynchronous failure', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2), createQueuedEvent(3)];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: async (event) => {
      if (event.eventId === 'event_0000000000000002') throw new Error('offline async');
      return true;
    },
  });

  assert.equal(await tracker.flush(), 1);
  assert.deepEqual(fixture.readQueue(), queued.slice(1));
});

test('serializes duplicate flush calls so queued events are not sent twice', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2)];
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: async (event) => {
      sentIds.push(event.eventId);
      await Promise.resolve();
      return true;
    },
  });

  assert.deepEqual(await Promise.all([tracker.flush(), tracker.flush()]), [2, 0]);
  assert.deepEqual(sentIds, ['event_0000000000000001', 'event_0000000000000002']);
  assert.deepEqual(fixture.readQueue(), []);
});

test('repairs non-array queue data without transporting it', async () => {
  for (const corrupted of [
    'not-an-array',
    { eventId: 'not-an-array' },
  ]) {
    let transportCalls = 0;
    const { tracker, fixture } = createTrackerFixture({
      initialQueue: corrupted,
      transport: () => {
        transportCalls += 1;
      },
    });

    assert.equal(await tracker.flush(), 0);
    assert.equal(transportCalls, 0);
    assert.deepEqual(fixture.readQueue(), []);
  }
});
