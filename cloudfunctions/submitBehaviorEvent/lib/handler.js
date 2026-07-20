'use strict';

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
    const wxContext = getWXContext();
    const openid = wxContext && wxContext.OPENID;
    if (typeof openid !== 'string' || openid.trim() === '') {
      throw new TypeError('trusted mini-program context is required');
    }
    const trustedAnonymousId = hashIdentity(openid, environment && environment.ANONYMIZATION_SALT);
    const envelope = validateEventEnvelope(event);
    if (envelope.anonymousId !== trustedAnonymousId) {
      throw new Error('event identity does not match trusted caller');
    }
    await store.submit(envelope);
    return { acknowledged: true };
  };
}

module.exports = { createSubmitBehaviorEventHandler };
