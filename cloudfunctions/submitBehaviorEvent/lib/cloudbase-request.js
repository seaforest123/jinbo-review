'use strict';

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function adaptCloudBaseRequest(value) {
  if (!isPlainObject(value)) return value;
  const metadataDescriptor = Object.getOwnPropertyDescriptor(value, 'userInfo');
  if (!metadataDescriptor) return value;
  if (!Object.hasOwn(metadataDescriptor, 'value')) {
    throw new TypeError('invalid CloudBase request metadata');
  }

  const adapted = {};
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'userInfo') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    Object.defineProperty(adapted, key, descriptor);
  }
  return adapted;
}

module.exports = { adaptCloudBaseRequest };
