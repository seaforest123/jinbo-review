'use strict';

const EVENT_QUEUE_KEY = 'goldFoilEventQueue';
const DELIVERY_SEMANTICS = 'at-least-once';
const MAX_FLUSH_SIZE = 50;
const MAX_ELAPSED_MS = 86400000;
const MAX_COUNTER = 100;
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const RAW_ID_PATTERN = /^[a-f0-9]{16,64}$/;
const EVENT_ID_PATTERN = /^event_[a-f0-9]{16,64}$/;
const SESSION_ID_PATTERN = /^session_[a-f0-9]{16,64}$/;
const ROUTE_ID_PATTERN = /^(?:foil_(?:making|application)_candidate|route_[a-z0-9]+(?:-[a-z0-9]+){0,5})$/;
const STEP_ID_PATTERN = /^(?:observe|motion|inspect|step-[1-9][0-9]{0,2})$/;
const TRIAL_VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-trial$/;

const ALLOWED_ENVIRONMENTS = new Set(['trial', 'test']);
const ALLOWED_TEST_ACCOUNT_TAGS = new Set(['team', 'teacher', 'invitee', null]);
const ALLOWED_NETWORK_TYPES = new Set(['wifi', '2g', '3g', '4g', '5g', 'none', 'unknown']);
const ALLOWED_ADAPTERS = new Set(['xr-frame', 'continuous-drag', 'select', 'inspect']);
const ALLOWED_REASONS = new Set([
  'user_exit',
  'user_skip',
  'load_failure',
  'capability_unavailable',
  'timeout',
]);
const ALLOWED_ACTIONS = new Set(['retry', 'home', 'archive', 'activity', 'share']);
const STORAGE_COORDINATORS = new WeakMap();

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

const INPUT_CONTEXT_KEYS = [
  'anonymousId',
  'sessionId',
  'routeId',
  'appVersion',
  'deviceCapabilities',
  'testAccountTag',
  'environment',
];

const EVENT_CONTEXT_KEYS = [...INPUT_CONTEXT_KEYS, 'source'];

const EVENT_KEYS = new Set([
  'eventId',
  ...EVENT_CONTEXT_KEYS,
  'delivery',
  'name',
  'occurredAt',
  'properties',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, allowedKeys) {
  const keys = Reflect.ownKeys(value);
  return keys.length === allowedKeys.length && allowedKeys.every((key) => Object.hasOwn(value, key));
}

function copyDeviceCapabilities(value) {
  const allowedKeys = ['xrFrame', 'continuousDrag', 'networkType'];
  if (
    !isPlainObject(value)
    || !hasExactKeys(value, allowedKeys)
    || typeof value.xrFrame !== 'boolean'
    || typeof value.continuousDrag !== 'boolean'
    || !ALLOWED_NETWORK_TYPES.has(value.networkType)
  ) {
    throw new TypeError('invalid device capabilities');
  }
  return {
    xrFrame: value.xrFrame,
    continuousDrag: value.continuousDrag,
    networkType: value.networkType,
  };
}

function validateContext(context) {
  if (!isPlainObject(context)) throw new TypeError('invalid event context');
  if (
    !hasExactKeys(context, INPUT_CONTEXT_KEYS)
    || !ANONYMOUS_ID_PATTERN.test(context.anonymousId)
    || !SESSION_ID_PATTERN.test(context.sessionId)
    || !ROUTE_ID_PATTERN.test(context.routeId)
    || !TRIAL_VERSION_PATTERN.test(context.appVersion)
    || !ALLOWED_TEST_ACCOUNT_TAGS.has(context.testAccountTag)
    || !ALLOWED_ENVIRONMENTS.has(context.environment)
  ) {
    throw new TypeError('invalid event context');
  }

  return {
    anonymousId: context.anonymousId,
    sessionId: context.sessionId,
    routeId: context.routeId,
    appVersion: context.appVersion,
    deviceCapabilities: copyDeviceCapabilities(context.deviceCapabilities),
    testAccountTag: context.testAccountTag,
    environment: context.environment,
    source: context.environment === 'test' ? 'test' : 'internal_trial',
  };
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
});

function validateProperties(properties) {
  if (!isPlainObject(properties)) throw new TypeError('invalid event properties');
  const copy = {};
  for (const key of Reflect.ownKeys(properties)) {
    const value = properties[key];
    if (!ALLOWED_PROPERTY_KEYS.has(key) || !PROPERTY_VALIDATORS[key](value)) {
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
  const keys = Reflect.ownKeys(event);
  if (
    keys.length !== EVENT_KEYS.size
    || !keys.every((key) => EVENT_KEYS.has(key))
    || !EVENT_ID_PATTERN.test(event.eventId)
    || event.delivery !== DELIVERY_SEMANTICS
    || !ALLOWED_EVENT_NAMES.has(event.name)
    || !isIsoTimestamp(event.occurredAt)
  ) {
    return false;
  }

  try {
    const context = {};
    for (const key of INPUT_CONTEXT_KEYS) context[key] = event[key];
    const safeContext = validateContext(context);
    if (safeContext.source !== event.source) return false;
    validateProperties(event.properties);
    return true;
  } catch (error) {
    return false;
  }
}

function isAcknowledged(result) {
  return (
    result === true
    || (
      isPlainObject(result)
      && hasExactKeys(result, ['acknowledged'])
      && result.acknowledged === true
    )
  );
}

function getStorageCoordinator(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) {
    throw new TypeError('storage must be an object');
  }
  let coordinator = STORAGE_COORDINATORS.get(storage);
  if (!coordinator) {
    coordinator = {
      operations: Promise.resolve(),
      acknowledgedEventIds: new Set(),
    };
    STORAGE_COORDINATORS.set(storage, coordinator);
  }
  return coordinator;
}

function createEventTracker({ storage, transport, clock, idFactory, context }) {
  const safeContext = validateContext(context);
  const coordinator = getStorageCoordinator(storage);
  const generatedEventIds = new Set();

  function serialize(operation) {
    const result = coordinator.operations.then(operation, operation);
    coordinator.operations = result.catch(() => undefined);
    return result;
  }

  async function readQueue() {
    const stored = await storage.get(EVENT_QUEUE_KEY);
    if (stored === undefined || stored === null) {
      return { queue: [], changed: false };
    }
    if (!Array.isArray(stored)) {
      return { queue: [], changed: true };
    }
    const queue = stored.filter(isValidQueuedEvent);
    return { queue, changed: queue.length !== stored.length };
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
      const rawEventId = idFactory();
      if (typeof rawEventId !== 'string' || !RAW_ID_PATTERN.test(rawEventId)) {
        throw new TypeError('invalid event id');
      }
      if (generatedEventIds.has(rawEventId)) {
        throw new Error('duplicate event id');
      }
      generatedEventIds.add(rawEventId);
      const event = freezeRecord({
        eventId: `event_${rawEventId}`,
        ...safeContext,
        deviceCapabilities: { ...safeContext.deviceCapabilities },
        delivery: DELIVERY_SEMANTICS,
        name,
        occurredAt: occurredAtIso,
        properties: safeProperties,
      });
      if (!isValidQueuedEvent(event)) {
        throw new TypeError('invalid event record');
      }

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
        const { queue, changed } = await readQueue();

        const acknowledgedPrefixIds = new Set();
        for (const event of queue.slice(0, MAX_FLUSH_SIZE)) {
          if (!coordinator.acknowledgedEventIds.has(event.eventId)) break;
          acknowledgedPrefixIds.add(event.eventId);
        }
        if (acknowledgedPrefixIds.size > 0) {
          const latest = await readQueue();
          const remaining = latest.queue.filter((event) => !acknowledgedPrefixIds.has(event.eventId));
          await storage.set(EVENT_QUEUE_KEY, remaining);
          for (const eventId of acknowledgedPrefixIds) {
            coordinator.acknowledgedEventIds.delete(eventId);
          }
          return acknowledgedPrefixIds.size;
        }

        let acknowledgedCount = 0;
        const acknowledgedIds = new Set();
        const batch = queue.slice(0, MAX_FLUSH_SIZE);
        for (const event of batch) {
          try {
            if (!isAcknowledged(await transport(event))) break;
            acknowledgedCount += 1;
            acknowledgedIds.add(event.eventId);
            coordinator.acknowledgedEventIds.add(event.eventId);
          } catch (error) {
            break;
          }
        }

        if (acknowledgedCount > 0 || changed) {
          const latest = await readQueue();
          const remaining = latest.queue.filter((event) => !acknowledgedIds.has(event.eventId));
          await storage.set(EVENT_QUEUE_KEY, remaining);
          for (const eventId of acknowledgedIds) {
            coordinator.acknowledgedEventIds.delete(eventId);
          }
        }
        return acknowledgedCount;
      });
    },
  };
}

module.exports = { createEventTracker, DELIVERY_SEMANTICS };
