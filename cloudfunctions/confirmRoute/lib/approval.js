'use strict';

const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const CONTENT_ITEM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const CONTENT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ALLOWED_ROUTE_IDS = new Set(['foil_making_candidate']);
const ALLOWED_ENVIRONMENTS = new Set(['development', 'trial', 'production']);
const ROUTE_STEP_CONTRACT = Object.freeze([
  Object.freeze({ id: 'twist', order: 1, adapter: 'cut' }),
  Object.freeze({ id: 'pack', order: 2, adapter: 'place' }),
  Object.freeze({ id: 'hammer', order: 3, adapter: 'hammer' }),
  Object.freeze({ id: 'inspect', order: 4, adapter: 'inspect' }),
  Object.freeze({ id: 'finish', order: 5, adapter: 'finish' }),
]);
const CANDIDATE_KEYS = ['routeId', 'contentItemId'];
const AUDIT_KEYS = ['reviewerAnonymousId', 'approvedAt'];
const STEP_KEYS = ['id', 'order', 'adapter', 'title'];
const CONFIRMED_ROUTE_KEYS = ['displayName', 'banner', 'steps'];
const STEP_ID_PATTERN = /^(?:twist|pack|hammer|inspect|finish)$/;
const APPROVAL_CONTRACT = Object.freeze({
  patterns: Object.freeze({
    stepId: STEP_ID_PATTERN.source,
  }),
});
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_BANNER_LENGTH = 200;
const MAX_STEP_TITLE_LENGTH = 120;
const FORBIDDEN_COPY_MARKERS = [
  '候选示意',
  '尚未经专业确认',
  '待专业确认',
  '内部测试',
];
const INTERNAL_PLACEHOLDER_MARKER = /(?:^|[^a-z0-9_])internal_placeholder(?:$|[^a-z0-9_])/i;
const REQUIRED_ROUTE_KEYS = [
  'id',
  'displayName',
  'status',
  'reviewStatus',
  'allowedEnvironment',
  'allowedEnvironments',
  'banner',
  'steps',
];
const OPTIONAL_ROUTE_KEYS = new Set([
  '_id',
  'contentItemId',
  'contentVersion',
  'approvalAudit',
]);

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

function hasText(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function hasBoundedText(value, maximumLength) {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= maximumLength
    && value === value.trim()
  );
}

function hasForbiddenCopyMarker(value) {
  return (
    FORBIDDEN_COPY_MARKERS.some((marker) => value.includes(marker))
    || INTERNAL_PLACEHOLDER_MARKER.test(value)
  );
}

function readExactDataArray(value, expectedLength) {
  if (
    !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== expectedLength
  ) {
    return null;
  }
  const expectedKeys = [
    ...Array.from({ length: expectedLength }, (_, index) => String(index)),
    'length',
  ];
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== expectedKeys.length
    || !expectedKeys.every((key) => Object.hasOwn(value, key))
  ) {
    return null;
  }
  const copy = [];
  for (let index = 0; index < expectedLength; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    copy.push(descriptor.value);
  }
  return copy;
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
  if (typeof request.routeId !== 'string' || !ALLOWED_ROUTE_IDS.has(request.routeId)) {
    throw new TypeError('invalid route');
  }
  if (
    typeof request.contentItemId !== 'string'
    || !CONTENT_ITEM_ID_PATTERN.test(request.contentItemId)
  ) {
    throw new TypeError('invalid content item');
  }
  return Object.freeze(request);
}

function readRouteDataProperties(existingRoute) {
  if (!isPlainObject(existingRoute)) throw new TypeError('invalid route config');
  const route = {};
  for (const key of Reflect.ownKeys(existingRoute)) {
    if (
      typeof key !== 'string'
      || (!REQUIRED_ROUTE_KEYS.includes(key) && !OPTIONAL_ROUTE_KEYS.has(key))
    ) {
      throw new TypeError('invalid route config field');
    }
    const descriptor = Object.getOwnPropertyDescriptor(existingRoute, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('invalid route config property');
    }
    route[key] = descriptor.value;
  }
  if (!REQUIRED_ROUTE_KEYS.every((key) => Object.hasOwn(route, key))) {
    throw new TypeError('incomplete route config');
  }
  return route;
}

function copyAndValidateSteps(steps) {
  if (!Array.isArray(steps) || steps.length !== ROUTE_STEP_CONTRACT.length) {
    throw new TypeError('invalid route steps');
  }
  const copied = steps.map((step, index) => {
    const snapshot = readExactDataProperties(step, STEP_KEYS);
    const expected = ROUTE_STEP_CONTRACT[index];
    if (
      !snapshot
      || snapshot.id !== expected.id
      || snapshot.order !== expected.order
      || snapshot.adapter !== expected.adapter
      || !hasText(snapshot.title)
    ) {
      throw new TypeError('invalid route step');
    }
    return Object.freeze({ ...snapshot });
  });
  return Object.freeze(copied);
}

function validateConfirmedRouteReplacement(contentItem) {
  const replacement = readExactDataProperties(
    readDataProperty(contentItem, 'confirmedRoute'),
    CONFIRMED_ROUTE_KEYS,
  );
  if (!replacement) throw new TypeError('invalid confirmed route replacement');
  if (
    !hasBoundedText(replacement.displayName, MAX_DISPLAY_NAME_LENGTH)
    || hasForbiddenCopyMarker(replacement.displayName)
  ) {
    throw new TypeError('invalid confirmed route displayName');
  }
  if (
    !hasBoundedText(replacement.banner, MAX_BANNER_LENGTH)
    || hasForbiddenCopyMarker(replacement.banner)
  ) {
    throw new TypeError('invalid confirmed route banner');
  }
  const steps = readExactDataArray(replacement.steps, ROUTE_STEP_CONTRACT.length);
  if (!steps) throw new TypeError('invalid confirmed route steps');
  const copiedSteps = steps.map((step, index) => {
    const snapshot = readExactDataProperties(step, STEP_KEYS);
    const expected = ROUTE_STEP_CONTRACT[index];
    if (
      !snapshot
      || typeof snapshot.id !== 'string'
      || !STEP_ID_PATTERN.test(snapshot.id)
      || snapshot.id !== expected.id
      || snapshot.order !== expected.order
      || snapshot.adapter !== expected.adapter
      || !hasBoundedText(snapshot.title, MAX_STEP_TITLE_LENGTH)
      || hasForbiddenCopyMarker(snapshot.title)
    ) {
      throw new TypeError('invalid confirmed route step');
    }
    return Object.freeze({ ...snapshot });
  });
  return Object.freeze({
    displayName: replacement.displayName,
    banner: replacement.banner,
    steps: Object.freeze(copiedSteps),
  });
}

function validateExistingRoute(existingRoute, routeId) {
  const route = readRouteDataProperties(existingRoute);
  if (
    route.id !== routeId
    || (Object.hasOwn(route, '_id') && route._id !== routeId)
  ) {
    throw new TypeError('route config id mismatch');
  }
  if (route.status !== 'internal_placeholder') {
    throw new TypeError('route config must be an internal placeholder');
  }
  if (route.reviewStatus !== 'internal_approved') {
    throw new TypeError('invalid route review status');
  }
  if (route.allowedEnvironment !== 'trial') {
    throw new TypeError('route config must target trial');
  }
  if (
    !hasText(route.displayName)
    || !hasText(route.banner)
    || !Array.isArray(route.allowedEnvironments)
    || route.allowedEnvironments.length === 0
    || route.allowedEnvironments.some((environment) => (
      typeof environment !== 'string' || !ALLOWED_ENVIRONMENTS.has(environment)
    ))
    || new Set(route.allowedEnvironments).size !== route.allowedEnvironments.length
    || !route.allowedEnvironments.includes('trial')
    || route.allowedEnvironments.includes('production')
  ) {
    throw new TypeError('invalid route environment or display config');
  }
  copyAndValidateSteps(route.steps);
  return Object.freeze({
    id: route.id,
    reviewStatus: route.reviewStatus,
    allowedEnvironment: route.allowedEnvironment,
    allowedEnvironments: Object.freeze([...route.allowedEnvironments]),
  });
}

function buildConfirmedRoute(candidate, contentItem, existingRoute, audit) {
  const request = validateRouteCandidate(candidate);
  const route = validateExistingRoute(existingRoute, request.routeId);
  const auditInput = readExactDataProperties(audit, AUDIT_KEYS);
  if (!auditInput) throw new TypeError('invalid approval audit');
  if (
    typeof auditInput.reviewerAnonymousId !== 'string'
    || !ANONYMOUS_ID_PATTERN.test(auditInput.reviewerAnonymousId)
  ) {
    throw new TypeError('invalid approval reviewer');
  }
  if (
    auditInput.approvedAt === null
    || typeof auditInput.approvedAt !== 'object'
    || Array.isArray(auditInput.approvedAt)
  ) {
    throw new TypeError('invalid approval timestamp');
  }
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
  const contentVersion = readDataProperty(contentItem, 'contentVersion');
  if (
    typeof contentVersion !== 'string'
    || !CONTENT_VERSION_PATTERN.test(contentVersion)
  ) {
    throw new TypeError('invalid content version');
  }
  const confirmedRoute = validateConfirmedRouteReplacement(contentItem);
  const approvalAudit = Object.freeze({
    reviewerAnonymousId: auditInput.reviewerAnonymousId,
    approvedAt: auditInput.approvedAt,
    contentItemId: request.contentItemId,
    contentVersion,
  });
  return Object.freeze({
    id: route.id,
    displayName: confirmedRoute.displayName,
    status: 'confirmed',
    reviewStatus: route.reviewStatus,
    allowedEnvironment: route.allowedEnvironment,
    allowedEnvironments: route.allowedEnvironments,
    banner: confirmedRoute.banner,
    steps: confirmedRoute.steps,
    contentItemId: request.contentItemId,
    contentVersion,
    approvalAudit,
  });
}

module.exports = {
  APPROVAL_CONTRACT,
  isAuthorizedReviewer,
  validateRouteCandidate,
  validateExistingRoute,
  validateConfirmedRouteReplacement,
  buildConfirmedRoute,
};
