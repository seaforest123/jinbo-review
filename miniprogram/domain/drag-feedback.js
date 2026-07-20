function calculateDragFeedback({ start, current, targetDirection, requiredDistance }) {
  if (!Number.isFinite(requiredDistance)) throw new TypeError('requiredDistance must be a finite number');
  if (requiredDistance <= 0) throw new RangeError('requiredDistance must be greater than zero');
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) throw new TypeError('start coordinates must be finite numbers');
  if (!Number.isFinite(current.x) || !Number.isFinite(current.y)) throw new TypeError('current coordinates must be finite numbers');
  if (targetDirection !== 'horizontal' && targetDirection !== 'vertical') throw new TypeError('targetDirection is invalid');

  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const horizontal = targetDirection === 'horizontal';
  const primaryDistance = Math.abs(horizontal ? dx : dy);
  const secondaryDistance = Math.abs(horizontal ? dy : dx);
  const directionOk = primaryDistance >= secondaryDistance;
  const progress = Number(Math.min(1, primaryDistance / requiredDistance).toFixed(2));

  return {
    progress,
    directionOk,
    complete: directionOk && progress >= 0.8,
    primaryDistance,
  };
}

module.exports = { calculateDragFeedback };
