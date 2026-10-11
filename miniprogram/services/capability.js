const SLOW_THRESHOLD_MS = 8000;
const FALLBACK_THRESHOLD_MS = 15000;

function evaluateLoadState(elapsedMs, failed) {
  if (failed) {
    return 'fallback';
  }
  if (!Number.isFinite(elapsedMs)) {
    throw new TypeError('elapsedMs must be a finite number');
  }
  if (elapsedMs < 0) {
    throw new RangeError('elapsedMs must not be negative');
  }
  if (elapsedMs >= FALLBACK_THRESHOLD_MS) {
    return 'fallback';
  }
  if (elapsedMs >= SLOW_THRESHOLD_MS) {
    return 'slow';
  }
  return 'loading';
}

function chooseAdapter(preferred, capabilities) {
  const available = capabilities && typeof capabilities === 'object' ? capabilities : {};

  if (['cut', 'place', 'hammer', 'inspect', 'finish', 'select'].includes(preferred)) {
    return preferred;
  }
  if (preferred === 'continuous-drag') {
    return available.continuousDrag === false ? 'select' : 'continuous-drag';
  }
  if (preferred === 'xr-frame') {
    if (available.xrFrame === true) {
      return 'xr-frame';
    }
    return available.continuousDrag === false ? 'select' : 'continuous-drag';
  }
  return 'select';
}

module.exports = { evaluateLoadState, chooseAdapter };
