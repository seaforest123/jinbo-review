'use strict';

const { resolveTrustedAnonymousId } = require('./security-context');

function createSubmitBehaviorEventHandler({
  getWXContext,
  environment,
  hashIdentity,
  validateEventEnvelope,
  store,
}) {
  if (
    typeof getWXContext !== 'function'
    || typeof hashIdentity !== 'function'
    || typeof validateEventEnvelope !== 'function'
    || !store
    || typeof store.submit !== 'function'
  ) {
    throw new TypeError('invalid submitBehaviorEvent dependencies');
  }
  return async function submitBehaviorEvent(event) {
    const trustedAnonymousId = resolveTrustedAnonymousId({
      getWXContext,
      environment,
      hashIdentity,
    });

    // 从 event 中提取需要的字段，过滤掉微信注入的额外字段
    const eventKeys = [
      'eventId', 'anonymousId', 'sessionId', 'routeId', 'appVersion',
      'deviceCapabilities', 'testAccountTag', 'environment', 'source',
      'delivery', 'name', 'occurredAt', 'properties'
    ];
    const cleanEvent = {};
    for (const key of eventKeys) {
      if (Object.hasOwn(event, key)) {
        cleanEvent[key] = event[key];
      }
    }

    const envelope = validateEventEnvelope(cleanEvent);
    if (envelope.anonymousId !== trustedAnonymousId) {
      throw new Error('event identity does not match trusted caller');
    }
    await store.submit(envelope);
    return { acknowledged: true };
  };
}

module.exports = { createSubmitBehaviorEventHandler };