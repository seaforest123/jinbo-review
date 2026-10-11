const RHYTHM_MARKERS = Object.freeze(['beat-1', 'beat-2', 'beat-3', 'beat-4']);
const CUT_STABILITY_THRESHOLD = Object.freeze({ beginner: 38, standard: 62 });
const FINISH_HOLD_MS = Object.freeze({ beginner: 420, standard: 520 });
const PLACEMENT_TARGET_THRESHOLD = .24;

function createCraftInteraction() {
  return {
    materialId: null,
    rhythmIndex: 0,
    rhythmComplete: false,
  };
}

function selectMaterial(state, materialId) {
  return {
    ...state,
    materialId: typeof materialId === 'string' && materialId ? materialId : null,
  };
}

function tapRhythm(state, markerId) {
  if (state.rhythmComplete || markerId !== RHYTHM_MARKERS[state.rhythmIndex]) return { ...state };
  const rhythmIndex = state.rhythmIndex + 1;
  return {
    ...state,
    rhythmIndex,
    rhythmComplete: rhythmIndex === RHYTHM_MARKERS.length,
  };
}

function scoreMotionStability(speeds) {
  const values = Array.isArray(speeds)
    ? speeds.filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
    : [];
  if (!values.length) return 0;
  if (values.length === 1) return 72;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
  return Math.max(0, Math.min(100, Math.round(100 - (deviation / mean) * 120)));
}

function evaluateCutGesture({ speeds, distance, beginner = true }) {
  const stability = scoreMotionStability(speeds);
  const enoughTravel = typeof distance === 'number' && Number.isFinite(distance) && distance >= 18;
  return {
    stability,
    enoughTravel,
    stable: enoughTravel && stability >= CUT_STABILITY_THRESHOLD[beginner ? 'beginner' : 'standard'],
  };
}

function evaluatePlacementGesture({ offset, settled, beginner = true }) {
  const nearTarget = typeof offset === 'number' && Number.isFinite(offset) && offset <= PLACEMENT_TARGET_THRESHOLD;
  return {
    nearTarget,
    accepted: nearTarget && (Boolean(settled) || beginner),
    assistedSettle: nearTarget && !settled && beginner,
  };
}

function resolvePlacementDrop({ x, y, settled, beginner = true }) {
  const validX = typeof x === 'number' && Number.isFinite(x);
  const validY = typeof y === 'number' && Number.isFinite(y);
  const rawOffset = validX && validY ? Math.hypot(x, y) : Infinity;
  const gesture = evaluatePlacementGesture({ offset: rawOffset, settled, beginner });
  const assistScale = gesture.accepted && beginner ? .22 : 1;
  return {
    ...gesture,
    rawOffset,
    x: validX ? x * assistScale : 0,
    y: validY ? y * assistScale : 0,
  };
}

function evaluateFinishHold({ durationMs, movement, beginner = true }) {
  const duration = typeof durationMs === 'number' && Number.isFinite(durationMs) ? durationMs : 0;
  const drift = typeof movement === 'number' && Number.isFinite(movement) ? movement : Infinity;
  return {
    stable: duration >= FINISH_HOLD_MS[beginner ? 'beginner' : 'standard'] && drift <= (beginner ? 18 : 10),
    requiredMs: FINISH_HOLD_MS[beginner ? 'beginner' : 'standard'],
  };
}

function evaluateHammerGesture({ pressDurationMs, intervalMs, beatPhase = null }) {
  const duration = typeof pressDurationMs === 'number' && Number.isFinite(pressDurationMs)
    ? Math.max(0, pressDurationMs)
    : 0;
  const interval = typeof intervalMs === 'number' && Number.isFinite(intervalMs)
    ? Math.max(0, intervalMs)
    : null;
  const power = duration < 60 ? 'light' : duration <= 360 ? 'steady' : 'heavy';
  const rhythm = interval === null ? 'first' : interval < 360 ? 'rushed' : interval <= 900 ? 'steady' : 'late';
  const normalizedPhase = typeof beatPhase === 'number' && Number.isFinite(beatPhase)
    ? Math.max(0, Math.min(1, beatPhase))
    : null;
  const beat = normalizedPhase === null
    ? null
    : normalizedPhase >= .44 && normalizedPhase <= .58
      ? 'perfect'
      : normalizedPhase >= .34 && normalizedPhase <= .68 ? 'good' : 'miss';
  return {
    power,
    rhythm,
    beat,
    isBalanced: power === 'steady' && (beat ? beat !== 'miss' : rhythm === 'first' || rhythm === 'steady'),
  };
}

module.exports = {
  RHYTHM_MARKERS,
  CUT_STABILITY_THRESHOLD,
  FINISH_HOLD_MS,
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
};
