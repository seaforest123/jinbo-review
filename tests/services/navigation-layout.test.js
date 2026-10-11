const test = require('node:test');
const assert = require('node:assert/strict');
const { getNavRightPadding, getNavTopPadding } = require('../../miniprogram/services/navigation-layout');

test('navigation right padding leaves a safe distance from the capsule', () => {
  const wxApi = {
    getMenuButtonBoundingClientRect: () => ({ left: 300 }),
    getWindowInfo: () => ({ windowWidth: 375 }),
  };
  assert.equal(getNavRightPadding(wxApi), 87);
});

test('navigation right padding has a bounded fallback when system data is unavailable', () => {
  assert.equal(getNavRightPadding(), 18);
  assert.equal(getNavRightPadding({ getMenuButtonBoundingClientRect: () => ({ left: 20 }), getSystemInfoSync: () => ({ windowWidth: 1000 }) }), 120);
  assert.equal(getNavRightPadding({ getMenuButtonBoundingClientRect: () => { throw new Error('unavailable'); } }), 18);
});

test('navigation top padding clears the capsule instead of trusting the safe-area inset', () => {
  // Notched iPhone: capsule sits at 48px with a 32px height, so content must start below 80px.
  assert.equal(getNavTopPadding({ getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32 }) }), 100);
  // Simulator without a notch: the capsule is higher, but the floor still keeps a readable gap.
  assert.equal(getNavTopPadding({ getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32 }) }), 76);
});

test('navigation top padding has a bounded fallback when capsule data is unavailable', () => {
  assert.equal(getNavTopPadding(), 68);
  assert.equal(getNavTopPadding({ getMenuButtonBoundingClientRect: () => ({ top: 'x', height: 32 }) }), 68);
  assert.equal(getNavTopPadding({ getMenuButtonBoundingClientRect: () => ({ top: 400, height: 32 }) }), 160);
  assert.equal(getNavTopPadding({ getMenuButtonBoundingClientRect: () => { throw new Error('unavailable'); } }), 68);
});
