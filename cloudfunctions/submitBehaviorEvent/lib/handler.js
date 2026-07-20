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
    const envelope = validateEventEnvelope(event);
    if (envelope.anonymousId !== trustedAnonymousId) {
      throw new Error('event identity does not match trusted caller');
    }
    await store.submit(envelope);
    return { acknowledged: true };
  };
}

module.exports = { createSubmitBehaviorEventHandler };
