const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RHYTHM_MARKERS,
  PLACEMENT_TARGET_THRESHOLD,
  createCraftInteraction,
  selectMaterial,
  tapRhythm,
  scoreMotionStability,
  evaluateCutGesture,
  evaluatePlacementGesture,
  resolvePlacementDrop,
  evaluateFinishHold,
  evaluateHammerGesture,
} = require('../../miniprogram/domain/craft-interaction');

test('material selection is immutable and resettable', () => {
  const initial = createCraftInteraction();
  const selected = selectMaterial(initial, 'foil-sheet');
  assert.equal(initial.materialId, null);
  assert.equal(selected.materialId, 'foil-sheet');
  assert.equal(selectMaterial(selected, null).materialId, null);
});

test('only four ordered rhythm markers complete the interaction', () => {
  let state = createCraftInteraction();
  state = tapRhythm(state, 'beat-2');
  assert.equal(state.rhythmIndex, 0);
  RHYTHM_MARKERS.forEach((marker) => { state = tapRhythm(state, marker); });
  assert.deepEqual(
    { rhythmIndex: state.rhythmIndex, rhythmComplete: state.rhythmComplete },
    { rhythmIndex: 4, rhythmComplete: true },
  );
});

test('scores steady cutting separately from erratic motion while keeping beginner travel achievable', () => {
  assert.ok(scoreMotionStability([.4, .42, .39, .41]) > scoreMotionStability([.1, 1.4, .2, 1.1]));
  assert.equal(evaluateCutGesture({ speeds: [.4], distance: 24, beginner: true }).stable, true);
  assert.equal(evaluateCutGesture({ speeds: [.4], distance: 8, beginner: true }).stable, false);
  assert.equal(evaluateCutGesture({ speeds: [.1, 1.4, .2, 1.1], distance: 40, beginner: false }).stable, false);
});

test('requires target settling outside beginner mode but safely assists a near beginner placement', () => {
  assert.deepEqual(
    evaluatePlacementGesture({ offset: .2, settled: false, beginner: true }),
    { nearTarget: true, accepted: true, assistedSettle: true },
  );
  assert.equal(evaluatePlacementGesture({ offset: .2, settled: false, beginner: false }).accepted, false);
  assert.equal(evaluatePlacementGesture({ offset: .25, settled: true, beginner: true }).accepted, false);
  assert.equal(evaluatePlacementGesture({ offset: .7, settled: true, beginner: true }).accepted, false);
  assert.equal(PLACEMENT_TARGET_THRESHOLD, .24);
});

test('beginner placement validates the raw drop before applying a small centering assist', () => {
  const offTarget = resolvePlacementDrop({ x: .9, y: .67, settled: true, beginner: true });
  assert.equal(offTarget.accepted, false);
  assert.equal(offTarget.rawOffset > 1, true);
  assert.equal(offTarget.x, .9);
  const nearTarget = resolvePlacementDrop({ x: .2, y: 0, settled: false, beginner: true });
  assert.equal(nearTarget.accepted, true);
  assert.equal(nearTarget.assistedSettle, true);
  assert.equal(Math.abs(nearTarget.x - .044) < Number.EPSILON, true);
});

test('finishing hold uses a forgiving beginner threshold without accepting unstable drift', () => {
  assert.equal(evaluateFinishHold({ durationMs: 420, movement: 12, beginner: true }).stable, true);
  assert.equal(evaluateFinishHold({ durationMs: 420, movement: 24, beginner: true }).stable, false);
  assert.equal(evaluateFinishHold({ durationMs: 420, movement: 4, beginner: false }).stable, false);
  assert.equal(evaluateFinishHold({ durationMs: 520, movement: 4, beginner: false }).stable, true);
});

test('infers hammer power and rhythm from portable touch timing values', () => {
  assert.deepEqual(
    evaluateHammerGesture({ pressDurationMs: 140, intervalMs: 560 }),
    { power: 'steady', rhythm: 'steady', beat: null, isBalanced: true },
  );
  assert.equal(evaluateHammerGesture({ pressDurationMs: 30, intervalMs: null }).power, 'light');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 480, intervalMs: 240 }).power, 'heavy');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 480, intervalMs: 240 }).rhythm, 'rushed');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 140, intervalMs: 1200 }).rhythm, 'late');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 140, intervalMs: 560, beatPhase: .5 }).beat, 'perfect');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 140, intervalMs: 560, beatPhase: .65 }).beat, 'good');
  assert.equal(evaluateHammerGesture({ pressDurationMs: 140, intervalMs: 560, beatPhase: .9 }).isBalanced, false);
});
