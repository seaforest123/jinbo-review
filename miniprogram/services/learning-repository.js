'use strict';

const STORAGE_KEY = 'candidate_learning_v1';
const VERSION = 1;

function createEmptySnapshot() {
  return { version: VERSION, sessions: [], favorites: [] };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function createLearningRepository({ routes, storage, now, idFactory }) {
  if (!Array.isArray(routes) || !storage || typeof storage.get !== 'function' || typeof storage.set !== 'function'
    || typeof now !== 'function' || typeof idFactory !== 'function') throw new TypeError('invalid learning repository dependencies');
  const routeMap = new Map(routes.map((route) => [route.id, route]));

  function getRoute(routeId) {
    const route = routeMap.get(routeId);
    if (!route) throw new TypeError('invalid candidate route');
    return route;
  }

  async function load() {
    try {
      const snapshot = await storage.get(STORAGE_KEY);
      if (!isPlainObject(snapshot) || snapshot.version !== VERSION || !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.favorites)) return createEmptySnapshot();
      return {
        version: VERSION,
        sessions: snapshot.sessions.filter((session) => isPlainObject(session) && routeMap.has(session.routeId)),
        favorites: snapshot.favorites.filter((routeId) => typeof routeId === 'string' && routeMap.has(routeId)),
      };
    } catch (error) {
      return createEmptySnapshot();
    }
  }

  async function save(snapshot) {
    try { await storage.set(STORAGE_KEY, snapshot); } catch (error) { /* Local records must never interrupt learning. */ }
  }

  function findSession(snapshot, sessionId) {
    if (typeof sessionId !== 'string') throw new TypeError('invalid learning session');
    const session = snapshot.sessions.find((candidate) => candidate.sessionId === sessionId);
    if (!session) throw new TypeError('unknown learning session');
    return session;
  }

  async function startLearningSession(routeId) {
    getRoute(routeId);
    const snapshot = await load();
    const session = { reportId: `local_${idFactory()}`, sessionId: `local_${idFactory()}`, routeId, startedAt: now(), status: 'active', steps: [] };
    snapshot.sessions.push(session);
    await save(snapshot);
    return { reportId: session.reportId, sessionId: session.sessionId, routeId };
  }

  async function recordStepOutcome(sessionId, stepId, outcome) {
    if (!isPlainObject(outcome) || !Number.isInteger(outcome.hintCount) || outcome.hintCount < 0 || !Number.isInteger(outcome.retryCount) || outcome.retryCount < 0) throw new TypeError('invalid learning outcome');
    const snapshot = await load();
    const session = findSession(snapshot, sessionId);
    const route = getRoute(session.routeId);
    if (session.status !== 'active' || !route.steps.some((step) => step.id === stepId)) throw new TypeError('invalid learning step');
    const index = session.steps.findIndex((step) => step.stepId === stepId);
    const record = { stepId, hintCount: outcome.hintCount, retryCount: outcome.retryCount, status: 'completed' };
    if (index === -1) session.steps.push(record); else session.steps[index] = record;
    await save(snapshot);
    return record;
  }

  async function finishLearningSession(sessionId, status) {
    const snapshot = await load();
    const session = findSession(snapshot, sessionId);
    if (session.status !== 'active') return session;
    const finishedAt = now();
    session.status = status;
    session.completedAt = status === 'completed' ? finishedAt : undefined;
    session.exitedAt = status === 'exited' ? finishedAt : undefined;
    session.elapsedMs = Math.max(0, finishedAt - session.startedAt);
    await save(snapshot);
    return session;
  }

  async function listSessionReports() {
    const snapshot = await load();
    return snapshot.sessions.filter((session) => session.status === 'completed' || session.status === 'exited').sort((left, right) => (right.completedAt || right.exitedAt) - (left.completedAt || left.exitedAt));
  }

  return {
    startLearningSession,
    recordStepOutcome,
    completeLearningSession: (sessionId) => finishLearningSession(sessionId, 'completed'),
    exitLearningSession: (sessionId) => finishLearningSession(sessionId, 'exited'),
    async getRouteProgress(routeId) {
      getRoute(routeId);
      const reports = (await listSessionReports()).filter((report) => report.routeId === routeId && report.status === 'completed');
      const latest = reports[0];
      return { routeId, completedCount: reports.length, lastCompletedAt: latest && latest.completedAt, lastElapsedMs: latest && latest.elapsedMs };
    },
    async toggleFavorite(routeId) {
      getRoute(routeId);
      const snapshot = await load();
      const index = snapshot.favorites.indexOf(routeId);
      if (index === -1) snapshot.favorites.push(routeId); else snapshot.favorites.splice(index, 1);
      await save(snapshot);
      return [...snapshot.favorites];
    },
    async listFavorites() { return (await load()).favorites; },
    listSessionReports,
  };
}

module.exports = { createLearningRepository };
