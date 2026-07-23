const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrialAnalytics } = require('../../miniprogram/services/trial-analytics');

const anonymousId = `anon_${'a'.repeat(32)}`;

test('creates one anonymous session tracker and forwards allowed experience events', async () => {
  const calls = [];
  const analytics = createTrialAnalytics({
    storage: { get: async () => undefined, set: async () => {} },
    cloudCall: async (request) => {
      if (request.name === 'bootstrapAnonymousId') return { result: { anonymousId } };
      calls.push(request.data);
      return { result: { acknowledged: true } };
    },
    idFactory: (() => { let n = 0; return () => `${(++n).toString(16).padStart(16, '0')}`; })(),
    clock: () => new Date('2026-07-21T00:00:00.000Z'),
    routeId: 'foil_making_candidate',
    capabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
  });

  await analytics.track('experience_start', {});
  await analytics.track('step_start', { stepId: 'observe', adapter: 'select' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].anonymousId, anonymousId);
  assert.equal(calls[0].sessionId, calls[1].sessionId);
  assert.equal(calls[1].name, 'step_start');
});

test('fails open when anonymous identity or event delivery cannot be established', async () => {
  const analytics = createTrialAnalytics({
    storage: { get: async () => undefined, set: async () => {} },
    cloudCall: async () => { throw new Error('offline'); },
    idFactory: () => '1111111111111111',
    clock: () => new Date('2026-07-21T00:00:00.000Z'),
    routeId: 'foil_making_candidate',
    capabilities: { xrFrame: false, continuousDrag: true, networkType: 'wifi' },
  });

  await assert.doesNotReject(analytics.track('experience_start', {}));
});
