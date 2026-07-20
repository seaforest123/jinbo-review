const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateLoadState, chooseAdapter } = require('../../miniprogram/services/capability');

test('uses the fixed 8-second warning and 15-second fallback thresholds', () => {
  assert.equal(evaluateLoadState(7999, false), 'loading');
  assert.equal(evaluateLoadState(8000, false), 'slow');
  assert.equal(evaluateLoadState(14999, false), 'slow');
  assert.equal(evaluateLoadState(15000, false), 'fallback');
  assert.equal(evaluateLoadState(1, true), 'fallback');
});

test('falls back to the simplest available adapter', () => {
  assert.equal(chooseAdapter('xr-frame', { xrFrame: false, continuousDrag: true }), 'continuous-drag');
  assert.equal(chooseAdapter('continuous-drag', { continuousDrag: false }), 'select');
  assert.equal(chooseAdapter('inspect', {}), 'inspect');
});

test('rejects non-numeric, non-finite, and negative elapsed durations', () => {
  for (const elapsedMs of ['8000', undefined, null, NaN, Infinity, -Infinity, -1]) {
    assert.throws(() => evaluateLoadState(elapsedMs, false));
  }
});

test('returns fallback immediately for failed loads with invalid elapsed durations', () => {
  for (const elapsedMs of [NaN, -1, '8000', undefined, null, Infinity, -Infinity]) {
    assert.equal(evaluateLoadState(elapsedMs, true), 'fallback');
  }
});

test('keeps the requested adapter from escalating when a capability is unavailable', () => {
  assert.equal(chooseAdapter('xr-frame', { xrFrame: true }), 'xr-frame');
  assert.equal(chooseAdapter('xr-frame', { xrFrame: false, continuousDrag: false }), 'select');
  assert.equal(chooseAdapter('continuous-drag', { continuousDrag: undefined, xrFrame: true }), 'continuous-drag');
  assert.equal(chooseAdapter('continuous-drag', { continuousDrag: false, xrFrame: true }), 'select');
  assert.equal(chooseAdapter('select', { xrFrame: true, continuousDrag: true }), 'select');
});

test('treats missing capabilities as the default non-xr capability set', () => {
  assert.equal(chooseAdapter('xr-frame', undefined), 'continuous-drag');
  assert.equal(chooseAdapter('continuous-drag', null), 'continuous-drag');
  assert.equal(chooseAdapter('inspect', null), 'inspect');
});

test('uses select for an unknown adapter', () => {
  assert.equal(chooseAdapter('unknown-adapter', { xrFrame: true, continuousDrag: true }), 'select');
});
