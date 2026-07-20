'use strict';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createBootstrapAnonymousIdHandler({ getWXContext, environment, hashIdentity }) {
  if (typeof getWXContext !== 'function' || typeof hashIdentity !== 'function') {
    throw new TypeError('invalid bootstrap dependencies');
  }
  return async function bootstrapAnonymousId(event) {
    if (!isPlainObject(event) || Reflect.ownKeys(event).length !== 0) {
      throw new TypeError('invalid bootstrap request');
    }
    const wxContext = getWXContext();
    const openid = wxContext && wxContext.OPENID;
    if (typeof openid !== 'string' || openid.trim() === '') {
      throw new TypeError('trusted mini-program context is required');
    }
    const anonymousId = hashIdentity(openid, environment && environment.ANONYMIZATION_SALT);
    return { anonymousId };
  };
}

module.exports = { createBootstrapAnonymousIdHandler };
