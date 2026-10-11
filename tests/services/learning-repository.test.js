'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { createLearningRepository } = require('../../miniprogram/services/learning-repository');

function createStorage(initialValue) {
  let value = initialValue;
  return {
    async get() { return value; },
    async set(key, nextValue) { value = nextValue; },
  };
}

test('persists a completed five-step report and summarizes its route', async () => {
  let time = 100;
  const repository = createLearningRepository({
    routes,
    storage: createStorage(),
    now: () => ++time,
    idFactory: () => 'local_001',
  });
  const session = await repository.startLearningSession(routes[0].id);
  for (const step of routes[0].steps) {
    await repository.recordStepOutcome(session.sessionId, step.id, { hintCount: 1, retryCount: 0 });
  }
  const report = await repository.completeLearningSession(session.sessionId);

  assert.equal(report.status, 'completed');
  assert.equal(report.steps.length, 5);
  assert.equal(report.elapsedMs, 1);
  assert.deepEqual(await repository.getRouteProgress(routes[0].id), {
    routeId: routes[0].id,
    completedCount: 1,
    lastCompletedAt: report.completedAt,
    lastElapsedMs: report.elapsedMs,
  });
});

test('preserves exit reports outside completed progress and toggles configured favorites', async () => {
  const repository = createLearningRepository({
    routes,
    storage: createStorage(),
    now: () => 100,
    idFactory: () => 'local_002',
  });
  const session = await repository.startLearningSession(routes[0].id);
  const report = await repository.exitLearningSession(session.sessionId);

  assert.equal(report.status, 'exited');
  assert.equal((await repository.getRouteProgress(routes[0].id)).completedCount, 0);
  assert.deepEqual(await repository.toggleFavorite(routes[0].id), [routes[0].id]);
  assert.deepEqual(await repository.toggleFavorite(routes[0].id), []);
  await assert.rejects(repository.toggleFavorite('unknown'), /route/i);
});

test('uses empty state for corrupt or unavailable storage', async () => {
  const repository = createLearningRepository({
    routes,
    storage: { get: async () => { throw new Error('offline'); }, set: async () => { throw new Error('offline'); } },
    now: () => 1,
    idFactory: () => 'local_003',
  });
  assert.deepEqual(await repository.listSessionReports(), []);
  assert.deepEqual(await repository.listFavorites(), []);
});
