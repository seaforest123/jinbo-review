'use strict';

function createLearningSession({ repository }) {
  if (!repository
    || typeof repository.startLearningSession !== 'function'
    || typeof repository.recordStepOutcome !== 'function'
    || typeof repository.completeLearningSession !== 'function'
    || typeof repository.exitLearningSession !== 'function') {
    throw new TypeError('invalid learning session repository');
  }

  let session = null;
  let startPromise = null;

  async function getActiveSession() {
    if (session) return session;
    if (!startPromise) return null;
    try {
      return await startPromise;
    } catch (error) {
      return null;
    }
  }

  return {
    start(routeId) {
      if (session) return Promise.resolve(session);
      if (!startPromise) {
        startPromise = Promise.resolve(repository.startLearningSession(routeId))
          .then((createdSession) => {
            session = createdSession;
            return session;
          });
      }
      return startPromise;
    },
    async recordStep(stepId, outcome) {
      const activeSession = await getActiveSession();
      return activeSession ? repository.recordStepOutcome(activeSession.sessionId, stepId, outcome) : null;
    },
    async complete() {
      const activeSession = await getActiveSession();
      return activeSession ? repository.completeLearningSession(activeSession.sessionId) : null;
    },
    async exit() {
      const activeSession = await getActiveSession();
      return activeSession ? repository.exitLearningSession(activeSession.sessionId) : null;
    },
  };
}

module.exports = { createLearningSession };
