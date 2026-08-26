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
const {
  APPROVAL_CONTRACT: approvalContract,
} = require('../../cloudfunctions/confirmRoute/lib/approval');
const routes = require('../../miniprogram/data/routes');
const { createExperienceController } = require('../../miniprogram/domain/experience-controller');

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
    properties: { stepId: 'twist', adapter: 'cut', elapsedMs: 1200, hintCount: 0, retryCount: 0 },
    ...overrides,
  };
}

test('exports an exact client/server contract snapshot to prevent deployment-copy drift', () => {
  assert.deepEqual(serverContract, clientContract);
  assert.ok(Object.isFrozen(serverContract));
  assert.ok(Object.isFrozen(clientContract));
});

test('keeps approval and both independently deployed event validators on the exact step ID pattern', () => {
  const expectedPattern = '^(?:twist|pack|hammer|inspect|finish)$';

  assert.equal(approvalContract.patterns.stepId, expectedPattern);
  assert.equal(approvalContract.patterns.stepId, clientContract.patterns.stepId);
  assert.equal(approvalContract.patterns.stepId, serverContract.patterns.stepId);
  assert.ok(Object.isFrozen(approvalContract));
  assert.ok(Object.isFrozen(approvalContract.patterns));
});

test('accepts and normalizes a real five-step client event', async () => {
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

  await tracker.track('step_complete', { stepId: 'twist', adapter: 'cut', elapsedMs: 1200 });
  const normalized = validateEventEnvelope(sent);

  assert.deepEqual(normalized, sent);
  assert.notEqual(normalized, sent);
  assert.ok(Object.isFrozen(normalized));
  assert.ok(Object.isFrozen(normalized.deviceCapabilities));
  assert.ok(Object.isFrozen(normalized.properties));
});

test('server revalidates the closed five-step event shape and nested data properties', () => {
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

test('accepts every five-step event name while preserving exact source semantics', () => {
  for (const name of serverContract.eventNames) {
    assert.equal(validateEventEnvelope(validEvent({ name })).name, name);
  }
  assert.equal(
    validateEventEnvelope(validEvent({ environment: 'trial', source: 'internal_trial' })).source,
    'internal_trial',
  );
});

test('delivers every real five-step controller event through the client and server contracts', async () => {
  const sent = [];
  const pending = [];
  let rawEventId = 0;
  let currentTime = 0;
  const tracker = createEventTracker({
    storage: { get: () => undefined, set: () => undefined },
    transport: (event) => {
      sent.push(validateEventEnvelope(event));
      return { acknowledged: true };
    },
    clock: () => new Date('2026-07-20T01:02:03.000Z'),
    idFactory: () => `${(++rawEventId).toString(16).padStart(16, '0')}`,
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
  const controller = createExperienceController({
    routes,
    routeId: 'foil_making_candidate',
    capabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
    now: () => { currentTime += 1000; return currentTime; },
    track: (name, properties) => {
      const delivery = tracker.track(name, properties);
      pending.push(delivery);
      return delivery;
    },
  });

  controller.start();
  controller.endIntro();
  for (let index = 0; index < 5; index += 1) controller.assistStep();
  await Promise.all(pending);

  const expectedSteps = [
    { stepId: 'twist', adapter: 'cut' },
    { stepId: 'pack', adapter: 'place' },
    { stepId: 'hammer', adapter: 'hammer' },
    { stepId: 'inspect', adapter: 'inspect' },
    { stepId: 'finish', adapter: 'finish' },
  ];
  assert.deepEqual(
    sent.filter(({ name }) => name === 'step_start').map(({ properties }) => properties),
    expectedSteps,
  );
  assert.deepEqual(
    sent.filter(({ name }) => name === 'step_complete').map(({ properties }) => properties),
    expectedSteps,
  );
  const decision = sent.find(({ name }) => name === 'inspection_decision');
  assert.equal(decision.properties.decision, 'accept');
  assert.ok(clientContract.qualities.includes(decision.properties.quality));
  const completion = sent.find(({ name }) => name === 'experience_complete');
  assert.ok(clientContract.qualities.includes(completion.properties.quality));
});
