const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { createExperienceController } = require('../../miniprogram/domain/experience-controller');

function createController(overrides = {}) {
  const events = [];
  const controller = createExperienceController({
    routes,
    routeId: 'foil_making_candidate',
    capabilities: { continuousDrag: true, xrFrame: false },
    now: () => 1000,
    track: (name, properties) => events.push({ name, properties }),
    ...overrides,
  });
  return { controller, events };
}

test('rejects a route ID outside the configured candidate routes', () => {
  assert.throws(() => createController({ routeId: 'unknown' }), /route/i);
});

test('runs the configured three steps and records lifecycle events', () => {
  const { controller, events } = createController();
  assert.equal(controller.getView().phase, 'idle');
  controller.start();
  assert.equal(controller.getView().phase, 'intro');
  controller.endIntro();
  assert.deepEqual([controller.getView().step.id, controller.getView().adapter], ['observe', 'select']);
  controller.completeStep();
  assert.deepEqual([controller.getView().step.id, controller.getView().adapter], ['motion', 'continuous-drag']);
  controller.completeDrag({ start: { x: 0, y: 0 }, current: { x: 80, y: 5 } });
  assert.equal(controller.getView().step.id, 'inspect');
  controller.completeStep();
  assert.equal(controller.getView().phase, 'completed');
  assert.deepEqual(events.map((event) => event.name), [
    'experience_start', 'step_start', 'step_complete', 'step_start',
    'step_complete', 'step_start', 'step_complete', 'experience_complete',
  ]);
});

test('records hints and retries for the active configured step', () => {
  const { controller, events } = createController();
  controller.start();
  controller.endIntro();
  controller.hint();
  controller.retry();
  assert.equal(controller.getView().hintCount, 1);
  assert.equal(controller.getView().retryCount, 1);
  assert.deepEqual(events.slice(-2), [
    { name: 'step_hint', properties: { stepId: 'observe', adapter: 'select', hintCount: 1 } },
    { name: 'step_retry', properties: { stepId: 'observe', adapter: 'select', retryCount: 1 } },
  ]);
});

test('falls back from continuous drag and records an exit without blocking state', () => {
  const { controller, events } = createController({ capabilities: { continuousDrag: false, xrFrame: false } });
  controller.start();
  controller.endIntro();
  controller.completeStep();
  assert.equal(controller.getView().adapter, 'select');
  assert.equal(controller.getView().isFallback, true);
  controller.exit();
  assert.equal(controller.getView().phase, 'exited');
  assert.deepEqual(events.at(-1), { name: 'experience_exit', properties: { reason: 'user_exit', elapsedMs: 0 } });
});

test('records local learning outcomes without changing the experience state machine', async () => {
  const calls = [];
  const { controller } = createController({
    learningSession: {
      start: (routeId) => calls.push(['start', routeId]),
      recordStep: (stepId, outcome) => calls.push(['step', stepId, outcome]),
      complete: () => ({ reportId: 'local_report_1', status: 'completed' }),
      exit: () => undefined,
    },
  });
  controller.start();
  controller.endIntro();
  controller.hint();
  controller.completeStep();
  controller.retry();
  controller.completeStep();
  controller.completeStep();
  await controller.whenLearningSettled();

  assert.equal(controller.getView().phase, 'completed');
  assert.equal(controller.getView().learningReport.reportId, 'local_report_1');
  assert.deepEqual(calls.filter((call) => call[0] === 'step'), [
    ['step', 'observe', { hintCount: 1, retryCount: 0 }],
    ['step', 'motion', { hintCount: 0, retryCount: 1 }],
    ['step', 'inspect', { hintCount: 0, retryCount: 0 }],
  ]);
});
