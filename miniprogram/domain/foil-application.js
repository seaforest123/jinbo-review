'use strict';

const MAX_STROKE_SPEED = 1000;
const COMPLETION_COVERAGE = 100;

function assertFiniteNonNegative(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
}

function createFoilApplication({ sheetsUsed = 1, failures = 0 } = {}) {
  if (!Number.isInteger(sheetsUsed) || sheetsUsed < 1) throw new TypeError('invalid sheetsUsed');
  if (!Number.isInteger(failures) || failures < 0) throw new TypeError('invalid failures');
  return Object.freeze({ coverage: 0, sheetsUsed, failures, complete: false, lastEvent: 'ready' });
}

function applyStroke(state, { distancePx, durationMs }) {
  if (!state || typeof state !== 'object') throw new TypeError('invalid foil application state');
  assertFiniteNonNegative(distancePx, 'distancePx');
  assertFiniteNonNegative(durationMs, 'durationMs');
  if (state.complete) return state;

  const speed = durationMs === 0 ? Infinity : (distancePx / durationMs) * 1000;
  if (speed > MAX_STROKE_SPEED) {
    return Object.freeze({
      coverage: 0,
      sheetsUsed: state.sheetsUsed + 1,
      failures: state.failures + 1,
      complete: false,
      lastEvent: 'broken',
    });
  }

  const increase = Math.max(12, Math.min(30, Math.round(distancePx * .3)));
  const coverage = Math.min(COMPLETION_COVERAGE, state.coverage + increase);
  return Object.freeze({
    coverage,
    sheetsUsed: state.sheetsUsed,
    failures: state.failures,
    complete: coverage >= COMPLETION_COVERAGE,
    lastEvent: coverage >= COMPLETION_COVERAGE ? 'complete' : 'placed',
  });
}

function resetFoilApplication(state) {
  if (!state || typeof state !== 'object') throw new TypeError('invalid foil application state');
  return createFoilApplication({ sheetsUsed: state.sheetsUsed, failures: state.failures });
}

module.exports = { MAX_STROKE_SPEED, COMPLETION_COVERAGE, createFoilApplication, applyStroke, resetFoilApplication };
