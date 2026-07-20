'use strict';

const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const CONTENT_ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const ALLOWED_ROUTE_IDS = new Set(['foil_making_candidate', 'foil_application_candidate']);
const CANDIDATE_KEYS = ['routeId', 'contentItemId'];

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readExactDataProperties(value, keys) {
  if (!isPlainObject(value)) return null;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) return null;
  const snapshot = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function readDataProperty(value, key) {
  if (!isPlainObject(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function isAuthorizedReviewer(anonymousId, reviewerIds) {
  return (
    typeof anonymousId === 'string'
    && ANONYMOUS_ID_PATTERN.test(anonymousId)
    && Array.isArray(reviewerIds)
    && reviewerIds.some((reviewerId) => (
      typeof reviewerId === 'string'
      && ANONYMOUS_ID_PATTERN.test(reviewerId)
      && reviewerId === anonymousId
    ))
  );
}

function validateRouteCandidate(candidate) {
  const request = readExactDataProperties(candidate, CANDIDATE_KEYS);
  if (!request) throw new TypeError('invalid route candidate request');
  if (!ALLOWED_ROUTE_IDS.has(request.routeId)) throw new TypeError('invalid route');
  if (
    typeof request.contentItemId !== 'string'
    || !CONTENT_ITEM_ID_PATTERN.test(request.contentItemId)
  ) {
    throw new TypeError('invalid content item');
  }
  return Object.freeze(request);
}

function buildConfirmedRoute(candidate, contentItem) {
  const request = validateRouteCandidate(candidate);
  if (readDataProperty(contentItem, '_id') !== request.contentItemId) {
    throw new TypeError('content item mismatch');
  }
  if (readDataProperty(contentItem, 'routeId') !== request.routeId) {
    throw new TypeError('cross-route content is forbidden');
  }
  if (readDataProperty(contentItem, 'reviewStatus') !== 'reviewed') {
    throw new TypeError('content must be reviewed');
  }
  if (readDataProperty(contentItem, 'allowedEnvironment') !== 'trial') {
    throw new TypeError('content must target trial only');
  }
  return Object.freeze({
    routeId: request.routeId,
    contentItemId: request.contentItemId,
    allowedEnvironment: 'trial',
    reviewStatus: 'reviewed',
  });
}

module.exports = { isAuthorizedReviewer, validateRouteCandidate, buildConfirmedRoute };
