'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ANIMATION_BUDGET_BYTES,
  FRAME_BUDGET_BYTES,
  MINI_PROGRAM_BUDGET_BYTES,
  VIDEO_BUDGET_BYTES,
  auditAssets,
} = require('../scripts/audit-mini-program-assets');

test('keeps the offline mini program inside project media budgets', () => {
  const result = auditAssets();
  assert.deepEqual(result.errors, []);
  assert.ok(result.packageBytes <= MINI_PROGRAM_BUDGET_BYTES);
  assert.ok(result.animationBytes <= ANIMATION_BUDGET_BYTES);
  assert.ok(result.videoBytes <= VIDEO_BUDGET_BYTES);
  assert.equal(result.assetCount, 25);
  assert.equal(result.referencedCount, 29);
});

test('uses explicit conservative release guard thresholds', () => {
  assert.equal(MINI_PROGRAM_BUDGET_BYTES, 2 * 1024 * 1024);
  assert.equal(ANIMATION_BUDGET_BYTES, 512 * 1024);
  assert.equal(FRAME_BUDGET_BYTES, 100 * 1024);
  assert.equal(VIDEO_BUDGET_BYTES, 384 * 1024);
});
