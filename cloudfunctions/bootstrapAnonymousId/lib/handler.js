'use strict';

const { resolveTrustedAnonymousId } = require('./security-context');

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
    if (!isPlainObject(event)) {
      throw new TypeError('invalid bootstrap request');
    }
    const anonymousId = resolveTrustedAnonymousId({ getWXContext, environment, hashIdentity });
    return { anonymousId };
  };
}

module.exports = { createBootstrapAnonymousIdHandler };
