'use strict';

const EVENT_QUEUE_KEY = 'goldFoilEventQueue';
const MAX_FLUSH_SIZE = 50;
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const TOKEN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const EVENT_ID_PATTERN = /^event_[a-zA-Z0-9_-]+$/;
const SESSION_ID_PATTERN = /^session_[a-zA-Z0-9_-]+$/;
const FORBIDDEN_VALUE_PATTERN = /openid|unionid|phone|email|name|address/i;
const PHONE_VALUE_PATTERN = /\d{7,}/;

const ALLOWED_EVENT_NAMES = new Set([
  'home_cta_click',
  'experience_start',
  'video_play',
  'video_skip',
  'step_start',
  'step_hint',
  'step_retry',
  'step_complete',
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
]);

const CONTEXT_KEYS = [
  'anonymousId',
  'sessionId',
  'routeId',
  'appVersion',
  'deviceCapabilities',
  'testAccountTag',
  'environment',
  'source',
];

const EVENT_KEYS = new Set([
  'eventId',
  ...CONTEXT_KEYS,
  'name',
  'occurredAt',
  'properties',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeScalar(value) {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  return (
    TOKEN_PATTERN.test(value)
    && !FORBIDDEN_VALUE_PATTERN.test(value)
    && !PHONE_VALUE_PATTERN.test(value)
  );
}

function copyScalarRecord(value) {
  if (!isPlainObject(value)) throw new TypeError('invalid device capabilities');
  const copy = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      FORBIDDEN_VALUE_PATTERN.test(key)
      || !isSafeScalar(entry)
    ) {
      throw new TypeError('invalid device capabilities');
    }
    copy[key] = entry;
  }
  return copy;
}

function validateContext(context) {
  if (!isPlainObject(context)) throw new TypeError('invalid event context');
  const keys = Object.keys(context);
  if (
    keys.length !== CONTEXT_KEYS.length
    || !CONTEXT_KEYS.every((key) => Object.hasOwn(context, key))
    || !ANONYMOUS_ID_PATTERN.test(context.anonymousId)
    || !SESSION_ID_PATTERN.test(context.sessionId)
    || !TOKEN_PATTERN.test(context.routeId)
    || typeof context.appVersion !== 'string'
    || context.appVersion.length === 0
    || context.appVersion.length > 64
    || (context.testAccountTag !== null && !TOKEN_PATTERN.test(context.testAccountTag))
    || !TOKEN_PATTERN.test(context.environment)
    || (context.source !== 'internal_trial' && context.source !== 'test')
  ) {
    throw new TypeError('invalid event context');
  }

  return {
    anonymousId: context.anonymousId,
    sessionId: context.sessionId,
    routeId: context.routeId,
    appVersion: context.appVersion,
    deviceCapabilities: copyScalarRecord(context.deviceCapabilities),
    testAccountTag: context.testAccountTag,
    environment: context.environment,
    source: context.source,
  };
}

function validateProperties(properties) {
  if (!isPlainObject(properties)) throw new TypeError('invalid event properties');
  const copy = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key) || !isSafeScalar(value)) {
      throw new TypeError('invalid event properties');
    }
    copy[key] = value;
  }
  return copy;
}

function freezeRecord(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') Object.freeze(child);
  }
  return Object.freeze(value);
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isValidQueuedEvent(event) {
  if (!isPlainObject(event)) return false;
  const keys = Object.keys(event);
  if (
    keys.length !== EVENT_KEYS.size
    || !keys.every((key) => EVENT_KEYS.has(key))
    || !EVENT_ID_PATTERN.test(event.eventId)
    || !ALLOWED_EVENT_NAMES.has(event.name)
    || !isIsoTimestamp(event.occurredAt)
  ) {
    return false;
  }

  try {
    const context = {};
    for (const key of CONTEXT_KEYS) context[key] = event[key];
    validateContext(context);
    validateProperties(event.properties);
    return true;
  } catch (error) {
    return false;
  }
}

function isAcknowledged(result) {
  if (result === false) return false;
  return !(isPlainObject(result) && result.acknowledged === false);
}

function createEventTracker({ storage, transport, clock, idFactory, context }) {
  const safeContext = validateContext(context);
  let operations = Promise.resolve();

  function serialize(operation) {
    const result = operations.then(operation, operation);
    operations = result.catch(() => undefined);
    return result;
  }

  async function readQueue() {
    const stored = await storage.get(EVENT_QUEUE_KEY);
    if (stored === undefined || stored === null) {
      return { queue: [], corrupted: false };
    }
    if (!Array.isArray(stored) || !stored.every(isValidQueuedEvent)) {
      return { queue: [], corrupted: true };
    }
    return { queue: stored, corrupted: false };
  }

  async function appendToQueue(event) {
    const { queue } = await readQueue();
    await storage.set(EVENT_QUEUE_KEY, [...queue, event]);
  }

  return {
    async track(name, properties = {}) {
      if (!ALLOWED_EVENT_NAMES.has(name)) {
        throw new TypeError('event name is not allowed');
      }
      const safeProperties = validateProperties(properties);
      const occurredAt = clock();
      const occurredAtIso = occurredAt instanceof Date
        ? occurredAt.toISOString()
        : new Date(occurredAt).toISOString();
      const event = freezeRecord({
        eventId: `event_${idFactory()}`,
        ...safeContext,
        deviceCapabilities: { ...safeContext.deviceCapabilities },
        name,
        occurredAt: occurredAtIso,
        properties: safeProperties,
      });

      return serialize(async () => {
        let acknowledged = false;
        try {
          acknowledged = isAcknowledged(await transport(event));
        } catch (error) {
          acknowledged = false;
        }
        if (!acknowledged) await appendToQueue(event);
        return event;
      });
    },

    flush() {
      return serialize(async () => {
        const { queue, corrupted } = await readQueue();
        if (corrupted) {
          await storage.set(EVENT_QUEUE_KEY, []);
          return 0;
        }

        let acknowledgedCount = 0;
        const batch = queue.slice(0, MAX_FLUSH_SIZE);
        for (const event of batch) {
          try {
            if (!isAcknowledged(await transport(event))) break;
            acknowledgedCount += 1;
          } catch (error) {
            break;
          }
        }

        if (acknowledgedCount > 0) {
          await storage.set(EVENT_QUEUE_KEY, queue.slice(acknowledgedCount));
        }
        return acknowledgedCount;
      });
    },
  };
}

module.exports = { createEventTracker };
