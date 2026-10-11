const test = require('node:test');
const assert = require('node:assert/strict');
const { applyStroke, createFoilApplication, resetFoilApplication } = require('../../miniprogram/domain/foil-application');

test('fast foil placement breaks the sheet and starts a fresh one', () => {
  const next = applyStroke(createFoilApplication(), { distancePx: 240, durationMs: 120 });
  assert.equal(next.lastEvent, 'broken');
  assert.equal(next.coverage, 0);
  assert.equal(next.failures, 1);
  assert.equal(next.sheetsUsed, 2);
});

test('slow placement accumulates coverage until the foil is complete', () => {
  let state = createFoilApplication();
  for (let index = 0; index < 4; index += 1) state = applyStroke(state, { distancePx: 100, durationMs: 500 });
  assert.equal(state.complete, true);
  assert.equal(state.coverage, 100);
  assert.equal(state.failures, 0);
});

test('manual restart preserves material use and previous failures', () => {
  const broken = applyStroke(createFoilApplication(), { distancePx: 240, durationMs: 120 });
  const reset = resetFoilApplication(broken);
  assert.equal(reset.coverage, 0);
  assert.equal(reset.failures, 1);
  assert.equal(reset.sheetsUsed, 2);
});
