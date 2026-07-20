function calculateDragFeedback({ start, current, targetDirection, requiredDistance }) {
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
