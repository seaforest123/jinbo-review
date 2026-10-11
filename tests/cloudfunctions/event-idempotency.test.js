'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCanonicalValue,
  canonicalizeEvent,
  hashCanonicalPayload,
  createBehaviorEventStore,
} = require('../../cloudfunctions/submitBehaviorEvent/lib/event-store');
const {
  validateEventEnvelope,
} = require('../../cloudfunctions/submitBehaviorEvent/lib/event-schema');

function validEvent(overrides = {}) {
  return {
    eventId: 'event_abcdef0123456789',
    anonymousId: `anon_${'a'.repeat(32)}`,
    sessionId: 'session_abcdef0123456789',
    routeId: 'foil_making_candidate',
    appVersion: '0.1.0-trial',
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    source: 'test',
    delivery: 'at-least-once',
    name: 'step_complete',
    occurredAt: '2026-07-20T01:02:03.000Z',
    properties: { stepId: 'twist', elapsedMs: 1200 },
    ...overrides,
  };
}

function createTransactionalDatabase({ pauseFirstTransaction = false } = {}) {
  const records = new Map();
  const calls = {
    transactions: 0,
    started: 0,
    commits: 0,
    active: 0,
    maxActive: 0,
    reads: 0,
    writes: 0,
    directCollections: 0,
  };
  let serial = Promise.resolve();
  let releaseFirstTransaction;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => {
    markFirstStarted = resolve;
  });
  const firstRelease = new Promise((resolve) => {
    releaseFirstTransaction = resolve;
  });

  const database = {
    collection() {
      calls.directCollections += 1;
      throw new Error('event persistence must stay inside runTransaction');
    },
    runTransaction(operation) {
      calls.transactions += 1;
      const transactionNumber = calls.transactions;
      const run = serial.then(async () => {
        calls.started += 1;
        calls.active += 1;
        calls.maxActive = Math.max(calls.maxActive, calls.active);
        if (transactionNumber === 1) {
          markFirstStarted();
          if (pauseFirstTransaction) await firstRelease;
        }
        try {
          const staged = new Map(records);
          const transaction = {
            collection(name) {
              assert.equal(name, 'behavior_events');
              return {
                doc(eventId) {
                  return {
                    async get() {
                      calls.reads += 1;
                      return { data: staged.get(eventId) || null };
                    },
                    async set({ data }) {
                      calls.writes += 1;
                      staged.set(eventId, data);
                    },
                  };
                },
              };
            },
          };
          const result = await operation(transaction);
          records.clear();
          for (const [key, value] of staged) records.set(key, value);
          calls.commits += 1;
          return result;
        } finally {
          calls.active -= 1;
        }
      });
      serial = run.catch(() => undefined);
      return run;
    },
  };

  return { database, records, calls, firstStarted, releaseFirstTransaction };
}

test('canonicalizes object key order and hashes the complete envelope deterministically', () => {
  const event = validEvent();
  const reordered = {
    properties: { elapsedMs: 1200, stepId: 'twist' },
    occurredAt: event.occurredAt,
    name: event.name,
    delivery: event.delivery,
    source: event.source,
    environment: event.environment,
    testAccountTag: event.testAccountTag,
    deviceCapabilities: {
      networkType: 'wifi',
      continuousDrag: true,
      xrFrame: false,
    },
    appVersion: event.appVersion,
    routeId: event.routeId,
    sessionId: event.sessionId,
    anonymousId: event.anonymousId,
    eventId: event.eventId,
  };

  assert.equal(canonicalizeEvent(reordered), canonicalizeEvent(event));
  assert.match(hashCanonicalPayload(event), /^[a-f0-9]{64}$/);
  assert.equal(hashCanonicalPayload(reordered), hashCanonicalPayload(event));
  assert.notEqual(
    hashCanonicalPayload(validEvent({ occurredAt: '2026-07-20T01:02:04.000Z' })),
    hashCanonicalPayload(event),
  );
});

test('builds every canonical object with a null prototype', () => {
  const canonical = buildCanonicalValue(validEvent());
  assert.equal(Object.getPrototypeOf(canonical), null);
  assert.equal(Object.getPrototypeOf(canonical.deviceCapabilities), null);
  assert.equal(Object.getPrototypeOf(canonical.properties), null);
});

test('rejects dangerous keys, accessors, symbols, and non-plain prototype values', () => {
  for (const dangerousKey of ['__proto__', 'prototype', 'constructor']) {
    const value = Object.create(null);
    Object.defineProperty(value, dangerousKey, {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 'forbidden',
    });
    assert.throws(() => canonicalizeEvent(value), /canonical event key/i);
  }

  const accessor = {};
  let getterReads = 0;
  Object.defineProperty(accessor, 'safe', {
    enumerable: true,
    get() {
      getterReads += 1;
      return 'forbidden';
    },
  });
  assert.throws(() => canonicalizeEvent(accessor), /canonical event property/i);
  assert.equal(getterReads, 0);
  assert.throws(() => canonicalizeEvent({ [Symbol('unsafe')]: true }), /canonical event key/i);
  assert.throws(() => canonicalizeEvent(Object.create({ inherited: true })), /canonical event value/i);
});

test('creates the first event once under its eventId with only envelope and payloadHash', async () => {
  const fixture = createTransactionalDatabase();
  const store = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });
  const event = validEvent();

  assert.deepEqual(await store.submit(event), { acknowledged: true });
  assert.deepEqual([...fixture.records.keys()], [event.eventId]);
  assert.deepEqual(Object.keys(fixture.records.get(event.eventId)).sort(), ['envelope', 'payloadHash']);
  assert.deepEqual(fixture.records.get(event.eventId).envelope, event);
  assert.equal(fixture.calls.transactions, 1);
  assert.equal(fixture.calls.writes, 1);
  assert.equal(fixture.calls.directCollections, 0);
});

test('creates the first event when CloudBase reports its document is absent', async () => {
  const event = validEvent();
  const writes = [];
  const database = {
    async runTransaction(operation) {
      return operation({
        collection(name) {
          assert.equal(name, 'behavior_events');
          return {
            doc(eventId) {
              assert.equal(eventId, event.eventId);
              return {
                async get() {
                  throw new Error(`document.get:fail document with _id ${eventId} does not exist`);
                },
                async set({ data }) {
                  writes.push(data);
                },
              };
            },
          };
        },
      });
    },
  };
  const store = createBehaviorEventStore({ database, validateEventEnvelope });

  assert.deepEqual(await store.submit(event), { acknowledged: true });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].envelope, event);
});

test('does not treat another CloudBase read failure as an absent document', async () => {
  let writes = 0;
  const database = {
    async runTransaction(operation) {
      return operation({
        collection() {
          return {
            doc() {
              return {
                async get() {
                  throw new Error('document.get:fail database unavailable');
                },
                async set() {
                  writes += 1;
                },
              };
            },
          };
        },
      });
    },
  };
  const store = createBehaviorEventStore({ database, validateEventEnvelope });

  await assert.rejects(store.submit(validEvent()), /database unavailable/i);
  assert.equal(writes, 0);
});

test('does not accept a missing-document error for another eventId', async () => {
  let writes = 0;
  const database = {
    async runTransaction(operation) {
      return operation({
        collection() {
          return {
            doc() {
              return {
                async get() {
                  throw new Error(
                    'document.get:fail document with _id event_1111111111111111 does not exist',
                  );
                },
                async set() {
                  writes += 1;
                },
              };
            },
          };
        },
      });
    },
  };
  const store = createBehaviorEventStore({ database, validateEventEnvelope });

  await assert.rejects(store.submit(validEvent()), /event_1111111111111111/);
  assert.equal(writes, 0);
});

test('rejects coercible anonymous and session IDs before starting a persistence transaction', async () => {
  for (const field of ['anonymousId', 'sessionId']) {
    const fixture = createTransactionalDatabase();
    const store = createBehaviorEventStore({
      database: fixture.database,
      validateEventEnvelope,
    });
    let coercions = 0;
    const coercibleId = {
      toString() {
        coercions += 1;
        return field === 'anonymousId'
          ? `anon_${'a'.repeat(32)}`
          : 'session_abcdef0123456789';
      },
    };

    await assert.rejects(store.submit(validEvent({ [field]: coercibleId })), /invalid event/i);
    assert.equal(coercions, 0, field);
    assert.equal(fixture.calls.transactions, 0, field);
    assert.equal(fixture.calls.writes, 0, field);
    assert.equal(fixture.records.size, 0, field);
  }
});

test('acknowledges a cross-restart replay of the same canonical payload without another write', async () => {
  const fixture = createTransactionalDatabase();
  const firstStore = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });
  const restartedStore = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });
  const event = validEvent();

  assert.deepEqual(await firstStore.submit(event), { acknowledged: true });
  assert.deepEqual(await restartedStore.submit({ ...event, properties: { elapsedMs: 1200, stepId: 'twist' } }), {
    acknowledged: true,
  });
  assert.equal(fixture.records.size, 1);
  assert.equal(fixture.calls.transactions, 2);
  assert.equal(fixture.calls.writes, 1);
});

test('serializable fake transaction model rejects overlapping conflicting submissions', async () => {
  const fixture = createTransactionalDatabase({ pauseFirstTransaction: true });
  const firstStore = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });
  const secondStore = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });

  const first = firstStore.submit(validEvent());
  await fixture.firstStarted;
  const second = secondStore.submit(validEvent({ occurredAt: '2026-07-20T01:02:04.000Z' }));
  assert.equal(fixture.calls.transactions, 2);
  assert.equal(fixture.calls.started, 1);
  fixture.releaseFirstTransaction();
  const results = await Promise.allSettled([first, second]);

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejection = results.find(({ status }) => status === 'rejected');
  assert.match(rejection.reason.message, /eventId conflict/i);
  assert.equal(fixture.records.size, 1);
  assert.equal(fixture.calls.transactions, 2);
  assert.equal(fixture.calls.writes, 1);
  assert.equal(fixture.calls.maxActive, 1);
  assert.equal(fixture.calls.commits, 1);
});

test('does not trust a pre-existing payloadHash without the same closed canonical envelope', async () => {
  const fixture = createTransactionalDatabase();
  const store = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope,
  });
  const submitted = validEvent();
  const differentEnvelope = validEvent({ name: 'experience_start' });
  fixture.records.set(submitted.eventId, {
    envelope: differentEnvelope,
    payloadHash: hashCanonicalPayload(submitted),
  });

  await assert.rejects(store.submit(submitted), /stored event|eventId conflict/i);
  assert.equal(fixture.calls.writes, 0);

  fixture.records.set(submitted.eventId, {
    envelope: submitted,
    payloadHash: hashCanonicalPayload(submitted),
    callerControlledField: true,
  });
  await assert.rejects(store.submit(submitted), /stored event|eventId conflict/i);
  assert.equal(fixture.calls.writes, 0);
});

test('revalidates a stored envelope against the closed schema before acknowledging', async () => {
  const fixture = createTransactionalDatabase();
  const submitted = validEvent();
  const storedEnvelope = { ...submitted, callerControlledField: true };
  fixture.records.set(submitted.eventId, {
    envelope: storedEnvelope,
    payloadHash: hashCanonicalPayload(storedEnvelope),
  });
  let storedValidationCalls = 0;
  const store = createBehaviorEventStore({
    database: fixture.database,
    validateEventEnvelope: (value) => {
      if (value === storedEnvelope) storedValidationCalls += 1;
      return validateEventEnvelope(value);
    },
  });

  await assert.rejects(store.submit(submitted), /invalid stored event/i);
  assert.equal(storedValidationCalls, 1);
  assert.equal(fixture.calls.writes, 0);
});
