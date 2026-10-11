'use strict';

const DELIVERY_SEMANTICS = 'at-least-once';
const APP_VERSION = '0.1.0-trial';
const MAX_ELAPSED_MS = 86400000;
const MAX_COUNTER = 100;
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const EVENT_ID_PATTERN = /^event_[a-f0-9]{16,64}$/;
const SESSION_ID_PATTERN = /^session_[a-f0-9]{16,64}$/;
const STEP_ID_PATTERN = /^(?:twist|pack|hammer|inspect|finish)$/;

const ALLOWED_ROUTE_IDS = new Set(['foil_making_candidate']);
const ALLOWED_ENVIRONMENTS = new Set(['trial', 'test']);
const ALLOWED_TEST_ACCOUNT_TAGS = new Set(['team', 'teacher', 'invitee', null]);
const ALLOWED_NETWORK_TYPES = new Set(['wifi', '2g', '3g', '4g', '5g', 'none', 'unknown']);
const ALLOWED_ADAPTERS = new Set(['cut', 'place', 'hammer', 'inspect', 'finish']);
const ALLOWED_REASONS = new Set([
  'user_exit',
  'user_skip',
  'load_failure',
  'capability_unavailable',
  'timeout',
]);
const ALLOWED_ACTIONS = new Set(['retry', 'home', 'archive', 'activity', 'share']);
const ALLOWED_DECISIONS = new Set(['rehammer', 'accept']);
const ALLOWED_QUALITIES = new Set(['perfect', 'minor', 'obvious']);
const ALLOWED_EVENT_NAMES = new Set([
  'home_cta_click',
  'experience_start',
  'video_play',
  'video_skip',
  'step_start',
  'step_hint',
  'step_retry',
  'step_complete',
  'inspection_decision',
  'experience_exit',
  'experience_complete',
  'result_action',
]);
const ALLOWED_PROPERTY_KEYS = new Set([
  'stepId',
  'adapter',
  'reason',
  'action',
  'elapsedMs',
  'hintCount',
  'retryCount',
  'decision',
  'quality',
]);

const EVENT_CONTRACT = Object.freeze({
  appVersion: APP_VERSION,
  deliverySemantics: DELIVERY_SEMANTICS,
  routeIds: Object.freeze([...ALLOWED_ROUTE_IDS]),
  environments: Object.freeze([...ALLOWED_ENVIRONMENTS]),
  testAccountTags: Object.freeze([...ALLOWED_TEST_ACCOUNT_TAGS]),
  networkTypes: Object.freeze([...ALLOWED_NETWORK_TYPES]),
  adapters: Object.freeze([...ALLOWED_ADAPTERS]),
  reasons: Object.freeze([...ALLOWED_REASONS]),
  actions: Object.freeze([...ALLOWED_ACTIONS]),
  decisions: Object.freeze([...ALLOWED_DECISIONS]),
  qualities: Object.freeze([...ALLOWED_QUALITIES]),
  eventNames: Object.freeze([...ALLOWED_EVENT_NAMES]),
  propertyKeys: Object.freeze([...ALLOWED_PROPERTY_KEYS]),
  maxElapsedMs: MAX_ELAPSED_MS,
  maxCounter: MAX_COUNTER,
  patterns: Object.freeze({
    anonymousId: ANONYMOUS_ID_PATTERN.source,
    eventId: EVENT_ID_PATTERN.source,
    sessionId: SESSION_ID_PATTERN.source,
    stepId: STEP_ID_PATTERN.source,
  }),
});

const EVENT_KEYS = [
  'eventId',
  'anonymousId',
  'sessionId',
  'routeId',
  'appVersion',
  'deviceCapabilities',
  'testAccountTag',
  'environment',
  'source',
  'delivery',
  'name',
  'occurredAt',
  'properties',
];

function invalidEvent() {
  return new TypeError('invalid event envelope');
}

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

function isBoundedInteger(value, maximum) {
  return Number.isInteger(value) && value >= 0 && value <= maximum;
}

const PROPERTY_VALIDATORS = Object.freeze({
  stepId: (value) => typeof value === 'string' && STEP_ID_PATTERN.test(value),
  adapter: (value) => ALLOWED_ADAPTERS.has(value),
  reason: (value) => ALLOWED_REASONS.has(value),
  action: (value) => ALLOWED_ACTIONS.has(value),
  elapsedMs: (value) => isBoundedInteger(value, MAX_ELAPSED_MS),
  hintCount: (value) => isBoundedInteger(value, MAX_COUNTER),
  retryCount: (value) => isBoundedInteger(value, MAX_COUNTER),
  decision: (value) => ALLOWED_DECISIONS.has(value),
  quality: (value) => ALLOWED_QUALITIES.has(value),
});

function copyDeviceCapabilities(value) {
  const snapshot = readExactDataProperties(value, ['xrFrame', 'continuousDrag', 'networkType']);
  if (
    !snapshot
    || typeof snapshot.xrFrame !== 'boolean'
    || typeof snapshot.continuousDrag !== 'boolean'
    || !ALLOWED_NETWORK_TYPES.has(snapshot.networkType)
  ) {
    throw invalidEvent();
  }
  return Object.freeze({
    xrFrame: snapshot.xrFrame,
    continuousDrag: snapshot.continuousDrag,
    networkType: snapshot.networkType,
  });
}

function copyProperties(value) {
  if (!isPlainObject(value)) throw invalidEvent();
  const copy = {};
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== 'string'
      || !descriptor
      || !Object.hasOwn(descriptor, 'value')
      || !ALLOWED_PROPERTY_KEYS.has(key)
      || !PROPERTY_VALIDATORS[key](descriptor.value)
    ) {
      throw invalidEvent();
    }
    copy[key] = descriptor.value;
  }
  return Object.freeze(copy);
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validateEventEnvelope(value) {
  const event = readExactDataProperties(value, EVENT_KEYS);
  if (
    !event
    || typeof event.eventId !== 'string'
    || !EVENT_ID_PATTERN.test(event.eventId)
    || typeof event.anonymousId !== 'string'
    || !ANONYMOUS_ID_PATTERN.test(event.anonymousId)
    || typeof event.sessionId !== 'string'
    || !SESSION_ID_PATTERN.test(event.sessionId)
    || !ALLOWED_ROUTE_IDS.has(event.routeId)
    || event.appVersion !== APP_VERSION
    || !ALLOWED_TEST_ACCOUNT_TAGS.has(event.testAccountTag)
    || !ALLOWED_ENVIRONMENTS.has(event.environment)
    || event.source !== (event.environment === 'test' ? 'test' : 'internal_trial')
    || event.delivery !== DELIVERY_SEMANTICS
    || !ALLOWED_EVENT_NAMES.has(event.name)
    || !isIsoTimestamp(event.occurredAt)
  ) {
    throw invalidEvent();
  }
  return Object.freeze({
    eventId: event.eventId,
    anonymousId: event.anonymousId,
    sessionId: event.sessionId,
    routeId: event.routeId,
    appVersion: event.appVersion,
    deviceCapabilities: copyDeviceCapabilities(event.deviceCapabilities),
    testAccountTag: event.testAccountTag,
    environment: event.environment,
    source: event.source,
    delivery: event.delivery,
    name: event.name,
    occurredAt: event.occurredAt,
    properties: copyProperties(event.properties),
  });
}

module.exports = { validateEventEnvelope, EVENT_CONTRACT };
