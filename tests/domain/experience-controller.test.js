const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { createExperienceController } = require('../../miniprogram/domain/experience-controller');

function createController() {
  return createExperienceController({
    routes, routeId: 'foil_making_candidate', capabilities: { continuousDrag: true },
    now: () => 1000, track: () => undefined,
  });
}

function enter(controller) { controller.start(); controller.endIntro(); }
function completeCut(controller) { [1, 1, 1].forEach((ratio) => controller.cut(ratio)); controller.completeStep(); }
function completePack(controller) { [[0, 0], [.1, 0], [0, -.1]].forEach(([x, y]) => controller.place(x, y)); controller.completeStep(); }
function completeHammer(controller) {
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) controller.hammer(row, col);
  controller.rotatePack();
  controller.completeStep();
}

test('runs five causal tasks against one shared foil session', () => {
  const controller = createController();
  enter(controller);
  assert.equal(controller.getView().step.id, 'twist');
  completeCut(controller);
  assert.equal(controller.getView().step.id, 'pack');
  completePack(controller);
  const initialized = controller.getView().session.grid;
  assert.equal(controller.getView().step.id, 'hammer');
  completeHammer(controller);
  assert.notDeepEqual(controller.getView().session.grid, initialized);
  assert.equal(controller.getView().step.id, 'inspect');
  controller.sweepInspection();
  controller.acceptInspection();
  assert.equal(controller.getView().step.id, 'finish');
  controller.completeStep();
  assert.equal(controller.getView().phase, 'completed');
});

test('blocks incomplete actions and exposes live derived metrics', () => {
  const controller = createController();
  enter(controller);
  controller.cut(.4);
  controller.completeStep();
  assert.equal(controller.getView().step.id, 'twist');
  completeCut(controller);
  completePack(controller);
  controller.hammer(0, 0);
  assert.ok(controller.getView().session.metrics.untreatedCount > 3);
  controller.completeStep();
  assert.equal(controller.getView().step.id, 'hammer');
});

test('inspection returns to hammer without resetting the grid', () => {
  const controller = createController();
  enter(controller); completeCut(controller); completePack(controller); completeHammer(controller);
  const before = controller.getView().session.grid;
  controller.returnToHammer();
  assert.equal(controller.getView().step.id, 'inspect');
  controller.sweepInspection();
  controller.returnToHammer();
  assert.equal(controller.getView().step.id, 'hammer');
  assert.deepEqual(controller.getView().session.grid, before);
  controller.hammer(0, 0);
  assert.notDeepEqual(controller.getView().session.grid, before);
});

test('task map has five nodes and retry preserves shared state', () => {
  const controller = createController();
  enter(controller); completeCut(controller); completePack(controller);
  const before = controller.getView().session.grid;
  controller.retry();
  assert.equal(controller.getView().retryCount, 1);
  assert.deepEqual(controller.getView().session.grid, before);
  assert.equal(controller.getView().taskMap.length, 5);
});

test('rotation changes display coordinate mapping and uses touched coverage to unlock', () => {
  const controller = createController();
  enter(controller); completeCut(controller); completePack(controller);
  for (let col = 0; col < 4; col += 1) controller.hammer(0, col);
  assert.ok(controller.getView().session.metrics.touchedCount >= 8);
  controller.rotatePack();
  assert.equal(controller.getView().session.rotation, 90);
  const before = controller.getView().session.grid[3][0];
  controller.hammer(0, 0);
  assert.ok(controller.getView().session.grid[3][0] < before);
});

test('beginner assistance guarantees a complete five-step path', () => {
  const controller = createController();
  enter(controller);
  controller.assistStep();
  assert.equal(controller.getView().step.id, 'pack');
  controller.assistStep();
  assert.equal(controller.getView().step.id, 'hammer');
  controller.assistStep();
  assert.equal(controller.getView().step.id, 'inspect');
  controller.assistStep();
  assert.equal(controller.getView().step.id, 'finish');
  controller.assistStep();
  assert.equal(controller.getView().phase, 'completed');
});

test('demo starts directly at hammer with a valid shared foil and no analytics or learning writes', async () => {
  const tracked = [];
  const learningCalls = [];
  const controller = createExperienceController({
    routes,
    routeId: 'foil_making_candidate',
    capabilities: { continuousDrag: true },
    now: () => 1000,
    track: (name) => tracked.push(name),
    learningSession: {
      start: () => { learningCalls.push('start'); },
      recordStep: () => { learningCalls.push('step'); },
    },
  });
  controller.startDemo();
  const view = controller.getView();
  assert.equal(view.step.id, 'hammer');
  assert.equal(view.session.sheetCount, 3);
  assert.equal(view.session.placements.length, 3);
  assert.equal(view.session.closed, true);
  await controller.whenLearningSettled();
  assert.deepEqual(tracked, []);
  assert.deepEqual(learningCalls, []);
});

test('completed hammering locks extra work except one explicitly requested rework hit', () => {
  const controller = createController();
  enter(controller); completeCut(controller); completePack(controller); completeHammer(controller);
  const ready = controller.getView();
  assert.equal(ready.step.id, 'inspect');
  controller.sweepInspection();
  controller.returnToHammer();
  const before = controller.getView().session.grid;
  const rotation = controller.getView().session.rotation;
  controller.hammer(0, 0);
  const afterRework = controller.getView().session.grid;
  assert.notDeepEqual(afterRework, before);
  controller.hammer(0, 1);
  controller.rotatePack();
  assert.deepEqual(controller.getView().session.grid, afterRework);
  assert.equal(controller.getView().session.rotation, rotation);
  controller.completeStep();
  controller.sweepInspection();
  controller.sweepInspection();
  assert.equal(controller.getView().session.inspectionSweeps, 1);
});
