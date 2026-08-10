const NOTICE = '候选视觉示意，尚待专业确认';

function framePaths(prefix) {
  return Object.freeze(Array.from(
    { length: 8 },
    (_, index) => `/assets/candidate/${prefix}-frame-${String(index + 1).padStart(2, '0')}.webp`,
  ));
}

const animations = Object.freeze({
  motion: Object.freeze({
    frames: framePaths('motion'),
    frameIntervalMs: 125,
    notice: NOTICE,
  }),
  inspect: Object.freeze({
    frames: framePaths('inspect'),
    frameIntervalMs: 140,
    notice: NOTICE,
  }),
});

function getStepAnimation(stepId) {
  const animation = animations[stepId];
  if (!animation) return null;
  return {
    frames: [...animation.frames],
    frameIntervalMs: animation.frameIntervalMs,
    notice: animation.notice,
  };
}

module.exports = { NOTICE, getStepAnimation };
