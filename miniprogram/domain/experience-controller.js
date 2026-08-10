const { createInitialState, reduceExperience } = require('./experience-machine');
const { chooseAdapter, evaluateLoadState } = require('../services/capability');
const {
  createFoilSession,
  createHammerStageSession,
  deriveGrid,
  cutPiece,
  placeSheet,
  initializeFromPlacements,
  hammerCell,
  stressCell,
  mentorFinishHammering,
  inspectCells,
} = require('./foil-session');
const { createFoilVisual, mapDisplayToGrid } = require('./foil-visual');

function createExperienceController({ routes, routeId, capabilities, now, track = () => {}, learningSession = null }) {
  if (!Array.isArray(routes)) throw new TypeError('routes must be an array');
  const route = routes.find((candidate) => candidate.id === routeId);
  if (!route) throw new TypeError('route must be a configured candidate');
  if (typeof now !== 'function' || typeof track !== 'function') throw new TypeError('invalid controller dependencies');

  let state = createInitialState();
  let session = createFoilSession();
  let loadState = 'loading';
  let learningReport = null;
  let learningOperations = Promise.resolve();

  function step() { return state.phase === 'step' ? route.steps[state.stepIndex] : null; }
  function adapter() { const active = step(); return active ? chooseAdapter(active.adapter, capabilities) : null; }
  function transition(event) { state = reduceExperience(state, event, route, now()); }
  function emit(name, properties) {
    try { const result = track(name, properties); if (result && result.catch) result.catch(() => undefined); } catch (error) { /* optional */ }
  }
  function record(operation) {
    if (!learningSession) return;
    learningOperations = learningOperations.then(operation).then((report) => { if (report) learningReport = report; }).catch(() => undefined);
  }
  function emitStepStart() { const active = step(); if (active) emit('step_start', { stepId: active.id, adapter: adapter() }); }
  function hammerReady() {
    const metrics = deriveGrid(session.grid, session.touched);
    return session.rotated && metrics.untreatedCount <= 6 && session.reworkHitsRemaining <= 0;
  }

  function getView() {
    const active = step();
    const metrics = deriveGrid(session.grid, session.touched);
    return {
      route,
      phase: state.phase,
      step: active,
      adapter: adapter(),
      hintCount: active ? state.hints[active.id] || 0 : 0,
      retryCount: active ? state.retries[active.id] || 0 : 0,
      loadState,
      isFallback: false,
      learningReport,
      session: {
        ...session,
        grid: session.grid.map((row) => [...row]),
        touched: session.touched.map((row) => [...row]),
        metrics,
        cells: inspectCells(session),
        visualCells: createFoilVisual(session),
      },
      taskMap: route.steps.map((candidate, index) => ({
        stepId: candidate.id,
        title: candidate.title,
        status: state.phase === 'completed' || index < state.stepIndex ? 'completed' : index === state.stepIndex ? 'current' : 'pending',
      })),
    };
  }

  function completeActiveStep() {
    const active = step();
    if (!active) return getView();
    const activeAdapter = adapter();
    transition({ type: 'COMPLETE_STEP' });
    record(() => learningSession && learningSession.recordStep(active.id, {
      hintCount: state.hints[active.id] || 0,
      retryCount: state.retries[active.id] || 0,
    }));
    emit('step_complete', { stepId: active.id, adapter: activeAdapter });
    if (state.phase === 'completed') {
      record(() => learningSession && learningSession.complete());
      emit('experience_complete', { elapsedMs: Math.max(0, state.completedAt - state.startedAt), quality: deriveGrid(session.grid, session.touched).quality });
    } else emitStepStart();
    return getView();
  }

  return {
    getView,
    whenLearningSettled() { return learningOperations.then(() => learningReport); },
    start() { transition({ type: 'START' }); record(() => learningSession && learningSession.start(route.id)); emit('experience_start', {}); return getView(); },
    startDemo() {
      if (state.phase !== 'idle') return getView();
      session = createHammerStageSession();
      transition({ type: 'START_AT_STEP', stepId: 'hammer' });
      return getView();
    },
    endIntro() { transition({ type: 'INTRO_ENDED' }); emitStepStart(); return getView(); },
    hint() { const active = step(); transition({ type: 'HINT' }); if (active) emit('step_hint', { stepId: active.id, adapter: adapter(), hintCount: state.hints[active.id] }); return getView(); },
    retry() { const active = step(); transition({ type: 'RETRY' }); if (active) emit('step_retry', { stepId: active.id, adapter: adapter(), retryCount: state.retries[active.id] }); return getView(); },
    cut(ratio, motionStable = true) { if (!step() || step().id !== 'twist') return getView(); session = cutPiece(session, ratio, motionStable); return getView(); },
    place(x, y) { if (!step() || step().id !== 'pack') return getView(); session = placeSheet(session, x, y); return getView(); },
    hammer(row, col) {
      if (!step() || step().id !== 'hammer' || hammerReady()) return getView();
      const source = mapDisplayToGrid(row, col, session.rotation);
      session = hammerCell(session, source.row, source.col);
      if (session.reworkHitsRemaining > 0) session = { ...session, reworkHitsRemaining: session.reworkHitsRemaining - 1 };
      return getView();
    },
    rotatePack() {
      if (step() && step().id === 'hammer' && !session.rotated && deriveGrid(session.grid, session.touched).touchedCount >= 6) {
        session = { ...session, rotated: true, rotation: (session.rotation + 90) % 360 };
      }
      return getView();
    },
    sweepInspection() { if (step() && step().id === 'inspect' && session.inspectionSweeps < 1) session = { ...session, inspectionSweeps: 1 }; return getView(); },
    returnToHammer() {
      if (!step() || step().id !== 'inspect' || session.inspectionSweeps < 1) return getView();
      session = { ...session, reworkHitsRemaining: 1 };
      transition({ type: 'RETURN_TO_STEP', stepId: 'hammer' });
      emit('inspection_decision', { decision: 'rehammer' });
      return getView();
    },
    acceptInspection() { if (!step() || step().id !== 'inspect' || session.inspectionSweeps < 1) return getView(); session = { ...session, flawAccepted: deriveGrid(session.grid, session.touched).quality !== 'perfect' }; emit('inspection_decision', { decision: 'accept', quality: deriveGrid(session.grid, session.touched).quality }); return completeActiveStep(); },
    stressFinish(row, col) {
      if (!step() || step().id !== 'finish') return getView();
      const source = mapDisplayToGrid(row, col, session.rotation);
      session = stressCell(session, source.row, source.col);
      return getView();
    },
    assistStep() {
      const active = step();
      if (!active) return getView();
      if (active.id === 'twist') {
        while (session.cuts.filter((cut) => cut.accepted).length < 3) session = cutPiece(session, 1);
        return completeActiveStep();
      }
      if (active.id === 'pack') {
        while (session.placements.length < 3) session = placeSheet(session, 0, 0);
        session = initializeFromPlacements(session);
        return completeActiveStep();
      }
      if (active.id === 'hammer') {
        session = mentorFinishHammering(session);
        return completeActiveStep();
      }
      if (active.id === 'inspect') {
        session = { ...session, inspectionSweeps: Math.max(1, session.inspectionSweeps) };
        return this.acceptInspection();
      }
      return completeActiveStep();
    },
    completeStep() {
      const active = step();
      if (!active) return getView();
      if (active.id === 'twist' && session.cuts.filter((cut) => cut.accepted).length < 3) return getView();
      if (active.id === 'pack') {
        if (session.placements.length < 3) return getView();
        session = initializeFromPlacements(session);
      }
      if (active.id === 'hammer' && !hammerReady()) return getView();
      if (active.id === 'inspect') return this.acceptInspection();
      return completeActiveStep();
    },
    updateLoad(elapsedMs, failed = false) { loadState = evaluateLoadState(elapsedMs, failed); return getView(); },
    exportResult() {
      const metrics = deriveGrid(session.grid, session.touched);
      return {
        grid: session.grid,
        touched: session.touched,
        rotation: session.rotation,
        metrics,
        visualCells: createFoilVisual(session),
        flawAccepted: session.flawAccepted,
        finishDamage: session.finishDamage,
      };
    },
    exit() { transition({ type: 'EXIT' }); record(() => learningSession && learningSession.exit()); return getView(); },
  };
}

module.exports = { createExperienceController };
