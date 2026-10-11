'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { createExperienceController } = require('../../miniprogram/domain/experience-controller');
const { createLearningSession } = require('../../miniprogram/services/learning-session');
const { createLearningRepository } = require('../../miniprogram/services/learning-repository');

function createRepository(calls) {
  return {
    async startLearningSession(routeId) {
      calls.push(['start', routeId]);
      return { sessionId: 'session_001', reportId: 'report_001', routeId };
    },
    async recordStepOutcome(sessionId, stepId, outcome) {
      calls.push(['step', sessionId, stepId, outcome]);
      return { sessionId, stepId, ...outcome, status: 'completed' };
    },
    async completeLearningSession(sessionId) {
      calls.push(['complete', sessionId]);
      return { reportId: 'report_001', sessionId, status: 'completed' };
    },
    async exitLearningSession(sessionId) {
      calls.push(['exit', sessionId]);
      return { reportId: 'report_001', sessionId, status: 'exited' };
    },
  };
}

test('starts one learning report and records the completed experience against it', async () => {
  const calls = [];
  const session = createLearningSession({ repository: createRepository(calls) });

  const [first, second] = await Promise.all([
    session.start('foil_making_candidate'),
    session.start('foil_making_candidate'),
  ]);
  await session.recordStep('twist', { hintCount: 1, retryCount: 0 });
  const report = await session.complete();

  assert.equal(first.sessionId, 'session_001');
  assert.equal(second.sessionId, 'session_001');
  assert.deepEqual(calls, [
    ['start', 'foil_making_candidate'],
    ['step', 'session_001', 'twist', { hintCount: 1, retryCount: 0 }],
    ['complete', 'session_001'],
  ]);
  assert.deepEqual(report, { reportId: 'report_001', sessionId: 'session_001', status: 'completed' });
});

test('does not create an exit report before a learning experience starts', async () => {
  const calls = [];
  const session = createLearningSession({ repository: createRepository(calls) });

  assert.equal(await session.exit(), null);
  assert.deepEqual(calls, []);
});

test('persists all five normal controller steps before returning its report', async () => {
  let time = 100;
  let snapshot;
  const repository = createLearningRepository({
    routes,
    storage: {
      async get() { return snapshot; },
      async set(key, value) { snapshot = value; },
    },
    now: () => ++time,
    idFactory: () => `id_${time}`,
  });
  const controller = createExperienceController({
    routes,
    routeId: 'foil_making_candidate',
    capabilities: { continuousDrag: true },
    now: () => ++time,
    track: () => undefined,
    learningSession: createLearningSession({ repository }),
  });

  controller.start();
  controller.endIntro();
  [1, 1, 1].forEach((ratio) => controller.cut(ratio));
  controller.completeStep();
  [[0, 0], [.1, 0], [0, -.1]].forEach(([x, y]) => controller.place(x, y));
  controller.completeStep();
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) controller.hammer(row, col);
  }
  controller.rotatePack();
  controller.completeStep();
  controller.sweepInspection();
  controller.acceptInspection();
  controller.completeStep();

  const report = await controller.whenLearningSettled();
  assert.equal(report.status, 'completed');
  assert.equal(report.steps.length, 5);
  assert.equal((await repository.listSessionReports()).length, 1);
});

test('requires all learning repository operations', () => {
  assert.throws(() => createLearningSession({ repository: {} }), /repository/i);
});
