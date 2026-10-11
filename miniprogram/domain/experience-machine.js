function createInitialState() {
  return {
    phase: 'idle',
    stepIndex: -1,
    startedAt: null,
    completedAt: null,
    exitedAt: null,
    hints: {},
    retries: {},
  };
}

function reduceExperience(state, event, route, now) {
  const nextState = { ...state };

  if (state.phase === 'completed' || state.phase === 'exited') return nextState;

  if (event.type === 'EXIT') return { ...nextState, phase: 'exited', exitedAt: now };
  if (event.type === 'START_AT_STEP' && state.phase === 'idle') {
    const index = route.steps.findIndex((step) => step.id === event.stepId);
    return index >= 0 ? { ...nextState, phase: 'step', stepIndex: index, startedAt: now } : nextState;
  }
  if (event.type === 'START' && state.phase === 'idle') return { ...nextState, phase: 'intro', startedAt: now };
  if (event.type === 'INTRO_ENDED' && state.phase === 'intro') return { ...nextState, phase: 'step', stepIndex: 0 };
  if (event.type === 'HINT' && state.phase === 'step') {
    const stepId = route.steps[state.stepIndex].id;
    return { ...nextState, hints: { ...state.hints, [stepId]: (state.hints[stepId] || 0) + 1 } };
  }
  if (event.type === 'RETRY' && state.phase === 'step') {
    const stepId = route.steps[state.stepIndex].id;
    return { ...nextState, retries: { ...state.retries, [stepId]: (state.retries[stepId] || 0) + 1 } };
  }
  if (event.type === 'COMPLETE_STEP' && state.phase === 'step') {
    return state.stepIndex === route.steps.length - 1
      ? { ...nextState, phase: 'completed', completedAt: now }
      : { ...nextState, stepIndex: state.stepIndex + 1 };
  }
  if (event.type === 'RETURN_TO_STEP' && state.phase === 'step') {
    const index = route.steps.findIndex((step) => step.id === event.stepId);
    return index >= 0 ? { ...nextState, stepIndex: index } : nextState;
  }

  return nextState;
}

module.exports = { createInitialState, reduceExperience };
