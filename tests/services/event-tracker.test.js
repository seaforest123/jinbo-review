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
    sessionId: 'session_experience-1',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true },
    testAccountTag: 'test-account-01',
    environment: 'trial',
    source: 'test',
    ...overrides,
  };
}

function createTrackerFixture({
  initialQueue,
  storageAsynchronous = false,
  transport = () => undefined,
  context = createContext(),
} = {}) {
  const fixture = createStorage(initialQueue, { asynchronous: storageAsynchronous });
  let nextId = 0;
  const { createEventTracker } = require(trackerModulePath);
  const tracker = createEventTracker({
    storage: fixture.storage,
    transport,
    clock: () => new Date(OCCURRED_AT),
    idFactory: () => String(++nextId).padStart(3, '0'),
    context,
  });
  return { tracker, fixture };
}

function createQueuedEvent(index) {
  return {
    eventId: `event_${String(index).padStart(3, '0')}`,
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_experience-1',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true },
    testAccountTag: 'test-account-01',
    environment: 'trial',
    source: 'test',
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
    eventId: 'event_001',
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_experience-1',
    routeId: 'route_gold-foil-1',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true },
    testAccountTag: 'test-account-01',
    environment: 'trial',
    source: 'test',
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
  const internal = createTrackerFixture({ context: createContext({ source: 'internal_trial' }) });
  const automated = createTrackerFixture({ context: createContext({ source: 'test' }) });

  assert.equal((await internal.tracker.track('home_cta_click', {})).source, 'internal_trial');
  assert.equal((await automated.tracker.track('home_cta_click', {})).source, 'test');
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

test('flushes at most fifty queued events in FIFO order', async () => {
  const queued = Array.from({ length: 52 }, (_, index) => createQueuedEvent(index + 1));
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: async (event) => {
      sentIds.push(event.eventId);
    },
  });

  assert.equal(await tracker.flush(), 50);
  assert.deepEqual(sentIds, queued.slice(0, 50).map((event) => event.eventId));
  assert.deepEqual(fixture.readQueue(), queued.slice(50));
});

test('flush stops at the first unacknowledged event and removes only confirmed entries', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2), createQueuedEvent(3)];
  const sentIds = [];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: (event) => {
      sentIds.push(event.eventId);
      return event.eventId === 'event_002' ? { acknowledged: false } : { acknowledged: true };
    },
  });

  assert.equal(await tracker.flush(), 1);
  assert.deepEqual(sentIds, ['event_001', 'event_002']);
  assert.deepEqual(fixture.readQueue(), queued.slice(1));
});

test('flush preserves the failed item and later items after an asynchronous failure', async () => {
  const queued = [createQueuedEvent(1), createQueuedEvent(2), createQueuedEvent(3)];
  const { tracker, fixture } = createTrackerFixture({
    initialQueue: queued,
    transport: async (event) => {
      if (event.eventId === 'event_002') throw new Error('offline async');
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
    },
  });

  assert.deepEqual(await Promise.all([tracker.flush(), tracker.flush()]), [2, 0]);
  assert.deepEqual(sentIds, ['event_001', 'event_002']);
  assert.deepEqual(fixture.readQueue(), []);
});

test('repairs corrupted queue data without transporting it', async () => {
  for (const corrupted of [
    'not-an-array',
    { eventId: 'not-an-array' },
    [createQueuedEvent(1), { openid: 'fictional-openid-must-be-rejected' }],
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
