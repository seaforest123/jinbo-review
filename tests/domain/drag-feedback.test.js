const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDragFeedback } = require('../../miniprogram/domain/drag-feedback');

test('maps continuous movement in the target direction to progress', () => {
  const feedback = calculateDragFeedback({
    start: { x: 10, y: 10 },
    current: { x: 90, y: 18 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });
  assert.equal(feedback.progress, 0.8);
  assert.equal(feedback.directionOk, true);
  assert.equal(feedback.complete, true);
});

test('does not count a mostly vertical path as horizontal progress', () => {
  const feedback = calculateDragFeedback({
    start: { x: 10, y: 10 },
    current: { x: 25, y: 100 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });
  assert.equal(feedback.directionOk, false);
  assert.equal(feedback.complete, false);
});

test('completes exactly at the rounded 0.8 progress threshold', () => {
  const feedback = calculateDragFeedback({
    start: { x: 0, y: 0 },
    current: { x: 80, y: 20 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });

  assert.deepEqual(feedback, {
    progress: 0.8,
    directionOk: true,
    complete: true,
    primaryDistance: 80,
  });
});

test('accepts equal primary and secondary distances and clamps progress', () => {
  const feedback = calculateDragFeedback({
    start: { x: 0, y: 0 },
    current: { x: 150, y: 150 },
    targetDirection: 'horizontal',
    requiredDistance: 100,
  });

  assert.deepEqual(feedback, {
    progress: 1,
    directionOk: true,
    complete: true,
    primaryDistance: 150,
  });
});
