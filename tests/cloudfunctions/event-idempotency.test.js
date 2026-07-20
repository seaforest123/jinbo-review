'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalizeEvent,
  hashCanonicalPayload,
  createBehaviorEventStore,
} = require('../../cloudfunctions/submitBehaviorEvent/lib/event-store');

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
    properties: { stepId: 'step-1', elapsedMs: 1200 },
    ...overrides,
  };
}

function createTransactionalDatabase() {
  const records = new Map();
  const calls = { transactions: 0, reads: 0, writes: 0, directCollections: 0 };
  let serial = Promise.resolve();

  const database = {
    collection() {
      calls.directCollections += 1;
      throw new Error('event persistence must stay inside runTransaction');
    },
    runTransaction(operation) {
      calls.transactions += 1;
      const run = serial.then(async () => {
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
        return result;
      });
      serial = run.catch(() => undefined);
      return run;
    },
  };

  return { database, records, calls };
}

test('canonicalizes object key order and hashes the complete envelope deterministically', () => {
  const event = validEvent();
  const reordered = {
    properties: { elapsedMs: 1200, stepId: 'step-1' },
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

test('creates the first event once under its eventId with only envelope and payloadHash', async () => {
  const fixture = createTransactionalDatabase();
  const store = createBehaviorEventStore({ database: fixture.database });
  const event = validEvent();

  assert.deepEqual(await store.submit(event), { acknowledged: true });
  assert.deepEqual([...fixture.records.keys()], [event.eventId]);
  assert.deepEqual(Object.keys(fixture.records.get(event.eventId)).sort(), ['envelope', 'payloadHash']);
  assert.deepEqual(fixture.records.get(event.eventId).envelope, event);
  assert.equal(fixture.calls.transactions, 1);
  assert.equal(fixture.calls.writes, 1);
  assert.equal(fixture.calls.directCollections, 0);
});

test('acknowledges a cross-restart replay of the same canonical payload without another write', async () => {
  const fixture = createTransactionalDatabase();
  const firstStore = createBehaviorEventStore({ database: fixture.database });
  const restartedStore = createBehaviorEventStore({ database: fixture.database });
  const event = validEvent();

  assert.deepEqual(await firstStore.submit(event), { acknowledged: true });
  assert.deepEqual(await restartedStore.submit({ ...event, properties: { elapsedMs: 1200, stepId: 'step-1' } }), {
    acknowledged: true,
  });
  assert.equal(fixture.records.size, 1);
  assert.equal(fixture.calls.transactions, 2);
  assert.equal(fixture.calls.writes, 1);
});

test('atomically rejects a concurrent conflicting payload for the same eventId', async () => {
  const fixture = createTransactionalDatabase();
  const firstStore = createBehaviorEventStore({ database: fixture.database });
  const secondStore = createBehaviorEventStore({ database: fixture.database });

  const results = await Promise.allSettled([
    firstStore.submit(validEvent()),
    secondStore.submit(validEvent({ occurredAt: '2026-07-20T01:02:04.000Z' })),
  ]);

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejection = results.find(({ status }) => status === 'rejected');
  assert.match(rejection.reason.message, /eventId conflict/i);
  assert.equal(fixture.records.size, 1);
  assert.equal(fixture.calls.transactions, 2);
  assert.equal(fixture.calls.writes, 1);
});

test('does not trust a pre-existing payloadHash without the same closed canonical envelope', async () => {
  const fixture = createTransactionalDatabase();
  const store = createBehaviorEventStore({ database: fixture.database });
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
