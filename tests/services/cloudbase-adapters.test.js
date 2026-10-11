'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCloudBaseIdentityAdapter,
  createCloudBaseEventAdapter,
} = require('../../miniprogram/services/cloudbase-adapters');

const ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;

test('identity adapter returns only the exact anonymousId function data object', async () => {
  const calls = [];
  const adapter = createCloudBaseIdentityAdapter({
    callFunction: async (request) => {
      calls.push(request);
      return { result: { anonymousId: ANONYMOUS_ID }, requestID: 'sdk-metadata' };
    },
  });

  assert.deepEqual(await adapter('bootstrapAnonymousId'), { anonymousId: ANONYMOUS_ID });
  assert.deepEqual(calls, [{ name: 'bootstrapAnonymousId', data: {} }]);
});

test('identity adapter fails closed on malformed, accessor, raw, or extra function data', async () => {
  const accessor = {};
  let reads = 0;
  Object.defineProperty(accessor, 'anonymousId', {
    enumerable: true,
    get() {
      reads += 1;
      return ANONYMOUS_ID;
    },
  });
  for (const result of [
    ANONYMOUS_ID,
    { anonymousId: 'trusted-openid' },
    { anonymousId: ANONYMOUS_ID, requestId: 'extra' },
    { anonymousId: ANONYMOUS_ID, openid: 'raw' },
    accessor,
  ]) {
    const adapter = createCloudBaseIdentityAdapter({ callFunction: async () => ({ result }) });
    await assert.rejects(adapter('bootstrapAnonymousId'), /identity response/i);
  }
  assert.equal(reads, 0);
});

test('event adapter returns a positive acknowledgement only for exact function data', async () => {
  const calls = [];
  const event = { eventId: 'event_abcdef0123456789' };
  const adapter = createCloudBaseEventAdapter({
    callFunction: async (request) => {
      calls.push(request);
      return { result: { acknowledged: true }, requestID: 'sdk-metadata' };
    },
  });

  assert.deepEqual(await adapter(event), { acknowledged: true });
  assert.deepEqual(calls, [{ name: 'submitBehaviorEvent', data: event }]);
});

test('event adapter fails closed for every non-exact acknowledgement', async () => {
  const accessor = {};
  let reads = 0;
  Object.defineProperty(accessor, 'acknowledged', {
    enumerable: true,
    get() {
      reads += 1;
      return true;
    },
  });
  for (const result of [
    true,
    { acknowledged: false },
    { acknowledged: 1 },
    { acknowledged: true, requestId: 'extra' },
    accessor,
  ]) {
    const adapter = createCloudBaseEventAdapter({ callFunction: async () => ({ result }) });
    await assert.rejects(adapter({ eventId: 'event_abcdef0123456789' }), /acknowledgement/i);
  }
  assert.equal(reads, 0);
});

test('both adapters reject unexpected caller arguments before cloud invocation', async () => {
  let calls = 0;
  const callFunction = async () => {
    calls += 1;
    return { result: { acknowledged: true } };
  };
  const identity = createCloudBaseIdentityAdapter({ callFunction });
  const event = createCloudBaseEventAdapter({ callFunction });

  await assert.rejects(identity('differentFunction'), /request/i);
  await assert.rejects(identity('bootstrapAnonymousId', { openid: 'caller-openid' }), /request/i);
  await assert.rejects(event({ eventId: 'event_abcdef0123456789' }, { openid: 'caller-openid' }), /request/i);
  assert.equal(calls, 0);
});
