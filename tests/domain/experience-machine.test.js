const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialState, reduceExperience } = require('../../miniprogram/domain/experience-machine');

const route = { steps: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] };

test('runs intro and three ordered steps before completion', () => {
  let state = createInitialState();
  state = reduceExperience(state, { type: 'START' }, route, 1000);
  assert.equal(state.phase, 'intro');
  state = reduceExperience(state, { type: 'INTRO_ENDED' }, route, 1100);
  assert.deepEqual([state.phase, state.stepIndex], ['step', 0]);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1200);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1300);
  state = reduceExperience(state, { type: 'COMPLETE_STEP' }, route, 1400);
  assert.deepEqual([state.phase, state.completedAt], ['completed', 1400]);
});

test('counts hints and retries for the current step', () => {
  let state = reduceExperience(createInitialState(), { type: 'START' }, route, 1000);
  state = reduceExperience(state, { type: 'INTRO_ENDED' }, route, 1100);
  state = reduceExperience(state, { type: 'HINT' }, route, 1200);
  state = reduceExperience(state, { type: 'RETRY' }, route, 1300);
  assert.equal(state.hints.s1, 1);
  assert.equal(state.retries.s1, 1);
});

test('creates the exact idle state shape', () => {
  assert.deepEqual(createInitialState(), {
    phase: 'idle',
    stepIndex: -1,
    startedAt: null,
    completedAt: null,
    exitedAt: null,
    hints: {},
    retries: {},
  });
});

test('rejects unknown and phase-invalid events with a fresh unchanged state', () => {
  const idle = createInitialState();
  const unknown = reduceExperience(idle, { type: 'UNKNOWN' }, route, 1000);
  const invalidPhase = reduceExperience(idle, { type: 'COMPLETE_STEP' }, route, 1000);

  assert.notStrictEqual(unknown, idle);
  assert.notStrictEqual(invalidPhase, idle);
  assert.deepEqual(unknown, idle);
  assert.deepEqual(invalidPhase, idle);
});

test('keeps completed and exited states immutable for every later event', () => {
  let completed = reduceExperience(createInitialState(), { type: 'START' }, route, 1000);
  completed = reduceExperience(completed, { type: 'INTRO_ENDED' }, route, 1100);
  completed = reduceExperience(completed, { type: 'COMPLETE_STEP' }, route, 1200);
  completed = reduceExperience(completed, { type: 'COMPLETE_STEP' }, route, 1300);
  completed = reduceExperience(completed, { type: 'COMPLETE_STEP' }, route, 1400);
  const afterCompleted = reduceExperience(completed, { type: 'HINT' }, route, 1500);

  const exited = reduceExperience(createInitialState(), { type: 'EXIT' }, route, 1600);
  const afterExited = reduceExperience(exited, { type: 'START' }, route, 1700);

  assert.notStrictEqual(afterCompleted, completed);
  assert.deepEqual(afterCompleted, completed);
  assert.notStrictEqual(afterExited, exited);
  assert.deepEqual(afterExited, exited);
});
