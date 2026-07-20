'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeConfig = require('../../miniprogram/config/runtime-config');
const {
  createEventTracker,
  EVENT_CONTRACT: clientContract,
} = require('../../miniprogram/services/event-tracker');
const {
  validateEventEnvelope,
  EVENT_CONTRACT: serverContract,
} = require('../../cloudfunctions/submitBehaviorEvent/lib/event-schema');

const ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;

function validEvent(overrides = {}) {
  return {
    eventId: 'event_abcdef0123456789',
    anonymousId: ANONYMOUS_ID,
    sessionId: 'session_abcdef0123456789',
    routeId: 'foil_making_candidate',
    appVersion: runtimeConfig.appVersion,
    deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    testAccountTag: 'team',
    environment: 'test',
    source: 'test',
    delivery: 'at-least-once',
    name: 'step_complete',
    occurredAt: '2026-07-20T01:02:03.000Z',
    properties: { stepId: 'step-1', elapsedMs: 1200, hintCount: 0, retryCount: 0 },
    ...overrides,
  };
}

test('exports an exact client/server contract snapshot to prevent deployment-copy drift', () => {
  assert.deepEqual(serverContract, clientContract);
  assert.ok(Object.isFrozen(serverContract));
  assert.ok(Object.isFrozen(clientContract));
});

test('accepts and normalizes a real Task 6 client event', async () => {
  let sent;
  const tracker = createEventTracker({
    storage: { get: () => undefined, set: () => undefined },
    transport: (event) => {
      sent = event;
      return { acknowledged: true };
    },
    clock: () => new Date('2026-07-20T01:02:03.000Z'),
    idFactory: () => 'fedcba9876543210',
    context: {
      anonymousId: ANONYMOUS_ID,
      sessionId: 'session_abcdef0123456789',
      routeId: 'foil_making_candidate',
      appVersion: runtimeConfig.appVersion,
      deviceCapabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
      testAccountTag: 'team',
      environment: 'test',
    },
  });

  await tracker.track('step_complete', { stepId: 'step-1', elapsedMs: 1200 });
  const normalized = validateEventEnvelope(sent);

  assert.deepEqual(normalized, sent);
  assert.notEqual(normalized, sent);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.deviceCapabilities));
  assert.ok(Object.isFrozen(normalized.properties));
});

test('server revalidates the closed Task 6 event shape and nested data properties', () => {
  const extraTopLevel = validEvent({ openid: 'caller-controlled-openid' });
  const extraCapability = validEvent({
    deviceCapabilities: {
      xrFrame: false,
      continuousDrag: true,
      networkType: 'wifi',
      model: 'caller-controlled-model',
    },
  });
  const invalidCases = [
    extraTopLevel,
    extraCapability,
    validEvent({ anonymousId: 'caller-controlled-openid' }),
    validEvent({ eventId: 'event_invalid' }),
    validEvent({ source: 'internal_trial' }),
    validEvent({ delivery: 'at-most-once' }),
    validEvent({ name: 'arbitrary_event' }),
    validEvent({ occurredAt: '2026-07-20' }),
    validEvent({ properties: { comment: 'free form is forbidden' } }),
  ];

  for (const event of invalidCases) {
    assert.throws(() => validateEventEnvelope(event), /invalid event/i);
  }

  const accessorEvent = validEvent();
  let reads = 0;
  Object.defineProperty(accessorEvent, 'anonymousId', {
    enumerable: true,
    get() {
      reads += 1;
      return ANONYMOUS_ID;
    },
  });
  assert.throws(() => validateEventEnvelope(accessorEvent), /invalid event/i);
  assert.equal(reads, 0);
});

test('rejects a non-string eventId without invoking coercion hooks', () => {
  let coercions = 0;
  const eventId = {
    toString() {
      coercions += 1;
      return 'event_abcdef0123456789';
    },
  };

  assert.throws(() => validateEventEnvelope(validEvent({ eventId })), /invalid event/i);
  assert.equal(coercions, 0);
});

test('rejects non-string anonymousId and sessionId without invoking coercion hooks', () => {
  for (const field of ['anonymousId', 'sessionId']) {
    let coercions = 0;
    const coercibleId = {
      toString() {
        coercions += 1;
        return field === 'anonymousId' ? ANONYMOUS_ID : 'session_abcdef0123456789';
      },
    };

    assert.throws(
      () => validateEventEnvelope(validEvent({ [field]: coercibleId })),
      /invalid event/i,
    );
    assert.equal(coercions, 0, field);
  }
});

test('accepts every Task 6 event name while preserving exact source semantics', () => {
  for (const name of serverContract.eventNames) {
    assert.equal(validateEventEnvelope(validEvent({ name })).name, name);
  }
  assert.equal(
    validateEventEnvelope(validEvent({ environment: 'trial', source: 'internal_trial' })).source,
    'internal_trial',
  );
});
