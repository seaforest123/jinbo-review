'use strict';

const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readDataProperty(value, key) {
  if (!isPlainObject(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function readExactResult(response, key, predicate, errorMessage) {
  const result = readDataProperty(response, 'result');
  if (!isPlainObject(result)) throw new TypeError(errorMessage);
  const keys = Reflect.ownKeys(result);
  const descriptor = Object.getOwnPropertyDescriptor(result, key);
  if (
    keys.length !== 1
    || keys[0] !== key
    || !descriptor
    || !Object.hasOwn(descriptor, 'value')
    || !predicate(descriptor.value)
  ) {
    throw new TypeError(errorMessage);
  }
  return descriptor.value;
}

function assertCallFunction(callFunction) {
  if (typeof callFunction !== 'function') throw new TypeError('callFunction must be a function');
}

function createCloudBaseIdentityAdapter({ callFunction }) {
  assertCallFunction(callFunction);
  return async function cloudBaseIdentityAdapter(functionName, ...callerInput) {
    if (functionName !== 'bootstrapAnonymousId' || callerInput.length !== 0) {
      throw new TypeError('invalid identity adapter request');
    }
    const response = await callFunction({ name: 'bootstrapAnonymousId', data: {} });
    const anonymousId = readExactResult(
      response,
      'anonymousId',
      (value) => typeof value === 'string' && ANONYMOUS_ID_PATTERN.test(value),
      'invalid anonymous identity response',
    );
    return { anonymousId };
  };
}

function createCloudBaseEventAdapter({ callFunction }) {
  assertCallFunction(callFunction);
  return async function cloudBaseEventAdapter(...callerInput) {
    if (callerInput.length !== 1) throw new TypeError('invalid event adapter request');
    const [event] = callerInput;
    const response = await callFunction({ name: 'submitBehaviorEvent', data: event });
    readExactResult(
      response,
      'acknowledged',
      (value) => value === true,
      'invalid event acknowledgement',
    );
    return { acknowledged: true };
  };
}

module.exports = { createCloudBaseIdentityAdapter, createCloudBaseEventAdapter };
