const { calculateDragFeedback } = require('./drag-feedback');
const { createInitialState, reduceExperience } = require('./experience-machine');
const { chooseAdapter, evaluateLoadState } = require('../services/capability');

const DRAG_REQUIRED_DISTANCE = 100;

function createExperienceController({ routes, routeId, capabilities, now, track = () => {}, learningSession = null }) {
  if (!Array.isArray(routes)) throw new TypeError('routes must be an array');
  const route = routes.find((candidate) => candidate.id === routeId);
  if (!route) throw new TypeError('route must be a configured candidate');
  if (typeof now !== 'function') throw new TypeError('now must be a function');
  if (typeof track !== 'function') throw new TypeError('track must be a function');

  let state = createInitialState();
  let dragProgress = 0;
  let loadState = 'loading';
  let learningReport = null;
  let learningOperations = Promise.resolve();

  function recordLearning(operation) {
    if (!learningSession) return;
    learningOperations = learningOperations.then(() => operation()).then((report) => {
      if (report) learningReport = report;
    }).catch(() => undefined);
  }

  function emit(name, properties) {
    try {
      const result = track(name, properties);
      if (result && typeof result.catch === 'function') result.catch(() => undefined);
    } catch (error) {
      // Analytics must never prevent the candidate experience from continuing.
    }
  }

  function step() {
    return state.phase === 'step' ? route.steps[state.stepIndex] : null;
  }

  function adapter() {
    const activeStep = step();
    return activeStep ? chooseAdapter(activeStep.adapter, capabilities) : null;
  }

  function emitStepStart() {
    const activeStep = step();
    emit('step_start', { stepId: activeStep.id, adapter: adapter() });
  }

  function transition(event) {
    state = reduceExperience(state, event, route, now());
  }

  function getView() {
    const activeStep = step();
    const activeAdapter = adapter();
    return {
      route,
      phase: state.phase,
      step: activeStep,
      adapter: activeAdapter,
      hintCount: activeStep ? (state.hints[activeStep.id] || 0) : 0,
      retryCount: activeStep ? (state.retries[activeStep.id] || 0) : 0,
      dragProgress,
      loadState,
      isFallback: Boolean(activeStep && activeAdapter !== activeStep.adapter) || loadState === 'fallback',
      learningReport,
    };
  }

  return {
    getView,
    whenLearningSettled() { return learningOperations.then(() => learningReport); },
    start() {
      transition({ type: 'START' });
      if (state.phase === 'intro') emit('experience_start', {});
      recordLearning(() => learningSession && learningSession.start(route.id));
      return getView();
    },
    endIntro() {
      transition({ type: 'INTRO_ENDED' });
      if (state.phase === 'step') emitStepStart();
      return getView();
    },
    hint() {
      const activeStep = step();
      transition({ type: 'HINT' });
      if (activeStep) emit('step_hint', {
        stepId: activeStep.id,
        adapter: adapter(),
        hintCount: state.hints[activeStep.id],
      });
      return getView();
    },
    retry() {
      const activeStep = step();
      transition({ type: 'RETRY' });
      dragProgress = 0;
      if (activeStep) emit('step_retry', {
        stepId: activeStep.id,
        adapter: adapter(),
        retryCount: state.retries[activeStep.id],
      });
      return getView();
    },
    completeStep() {
      const activeStep = step();
      if (!activeStep) return getView();
      const activeAdapter = adapter();
      transition({ type: 'COMPLETE_STEP' });
      dragProgress = 0;
      recordLearning(() => learningSession && learningSession.recordStep(activeStep.id, {
        hintCount: state.hints[activeStep.id] || 0,
        retryCount: state.retries[activeStep.id] || 0,
      }));
      emit('step_complete', { stepId: activeStep.id, adapter: activeAdapter });
      if (state.phase === 'completed') {
        recordLearning(() => learningSession && learningSession.complete());
        emit('experience_complete', { elapsedMs: Math.max(0, state.completedAt - state.startedAt) });
      }
      else emitStepStart();
      return getView();
    },
    completeDrag({ start, current }) {
      if (adapter() !== 'continuous-drag') return getView();
      const feedback = calculateDragFeedback({
        start,
        current,
        targetDirection: 'horizontal',
        requiredDistance: DRAG_REQUIRED_DISTANCE,
      });
      dragProgress = feedback.progress;
      return feedback.complete ? this.completeStep() : getView();
    },
    updateLoad(elapsedMs, failed = false) {
      loadState = evaluateLoadState(elapsedMs, failed);
      return getView();
    },
    exit() {
      transition({ type: 'EXIT' });
      if (state.phase === 'exited') emit('experience_exit', {
        reason: 'user_exit',
        elapsedMs: Math.max(0, state.exitedAt - (state.startedAt || state.exitedAt)),
      });
      if (state.phase === 'exited') recordLearning(() => learningSession && learningSession.exit());
      return getView();
    },
  };
}

module.exports = { createExperienceController, DRAG_REQUIRED_DISTANCE };
