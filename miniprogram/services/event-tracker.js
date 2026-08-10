'use strict';

const runtimeConfig = require('../config/runtime-config');

const EVENT_QUEUE_KEY = 'goldFoilEventQueue';
const DELIVERY_SEMANTICS = 'at-least-once';
const MAX_FLUSH_SIZE = 50;
const MAX_ELAPSED_MS = 86400000;
const MAX_COUNTER = 100;
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;
const RAW_ID_PATTERN = /^[a-f0-9]{16,64}$/;
const EVENT_ID_PATTERN = /^event_[a-f0-9]{16,64}$/;
const SESSION_ID_PATTERN = /^session_[a-f0-9]{16,64}$/;
const STEP_ID_PATTERN = /^(?:observe|motion|inspect|step-[1-9][0-9]{0,2})$/;

const ALLOWED_ROUTE_IDS = new Set(['foil_making_candidate']);
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
const EVENT_QUEUE_COORDINATOR = {
  operations: Promise.resolve(),
  acknowledgedEventIds: new Set(),
  reservedEventIds: new Set(),
};

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

const EVENT_CONTRACT = Object.freeze({
  appVersion: runtimeConfig.appVersion,
  deliverySemantics: DELIVERY_SEMANTICS,
  routeIds: Object.freeze([...ALLOWED_ROUTE_IDS]),
  environments: Object.freeze([...ALLOWED_ENVIRONMENTS]),
  testAccountTags: Object.freeze([...ALLOWED_TEST_ACCOUNT_TAGS]),
  networkTypes: Object.freeze([...ALLOWED_NETWORK_TYPES]),
  adapters: Object.freeze([...ALLOWED_ADAPTERS]),
  reasons: Object.freeze([...ALLOWED_REASONS]),
  actions: Object.freeze([...ALLOWED_ACTIONS]),
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

function readExactDataProperties(value, allowedKeys) {
  if (!isPlainObject(value) || !hasExactKeys(value, allowedKeys)) return null;
  const snapshot = {};
  for (const key of allowedKeys) {
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

function copyDeviceCapabilities(value) {
  const allowedKeys = ['xrFrame', 'continuousDrag', 'networkType'];
  const snapshot = readExactDataProperties(value, allowedKeys);
  if (
    !snapshot
    || typeof snapshot.xrFrame !== 'boolean'
    || typeof snapshot.continuousDrag !== 'boolean'
    || !ALLOWED_NETWORK_TYPES.has(snapshot.networkType)
  ) {
    throw new TypeError('invalid device capabilities');
  }
  return {
    xrFrame: snapshot.xrFrame,
    continuousDrag: snapshot.continuousDrag,
    networkType: snapshot.networkType,
  };
}

function validateContext(context) {
  const snapshot = readExactDataProperties(context, INPUT_CONTEXT_KEYS);
  if (
    !snapshot
    || typeof snapshot.anonymousId !== 'string'
    || !ANONYMOUS_ID_PATTERN.test(snapshot.anonymousId)
    || typeof snapshot.sessionId !== 'string'
    || !SESSION_ID_PATTERN.test(snapshot.sessionId)
    || !ALLOWED_ROUTE_IDS.has(snapshot.routeId)
    || snapshot.appVersion !== runtimeConfig.appVersion
    || !ALLOWED_TEST_ACCOUNT_TAGS.has(snapshot.testAccountTag)
    || !ALLOWED_ENVIRONMENTS.has(snapshot.environment)
  ) {
    throw new TypeError('invalid event context');
  }

  return {
    anonymousId: snapshot.anonymousId,
    sessionId: snapshot.sessionId,
    routeId: snapshot.routeId,
    appVersion: snapshot.appVersion,
    deviceCapabilities: copyDeviceCapabilities(snapshot.deviceCapabilities),
    testAccountTag: snapshot.testAccountTag,
    environment: snapshot.environment,
    source: snapshot.environment === 'test' ? 'test' : 'internal_trial',
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
    const descriptor = Object.getOwnPropertyDescriptor(properties, key);
    const value = descriptor && Object.hasOwn(descriptor, 'value')
      ? descriptor.value
      : undefined;
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

function readValidQueuedEvent(event) {
  try {
    const record = readExactDataProperties(event, [...EVENT_KEYS]);
    if (
      !record
      || typeof record.eventId !== 'string'
      || !EVENT_ID_PATTERN.test(record.eventId)
      || record.delivery !== DELIVERY_SEMANTICS
      || !ALLOWED_EVENT_NAMES.has(record.name)
      || !isIsoTimestamp(record.occurredAt)
    ) {
      return null;
    }
    const context = {};
    for (const key of INPUT_CONTEXT_KEYS) context[key] = record[key];
    const safeContext = validateContext(context);
    if (safeContext.source !== record.source) return null;
    validateProperties(record.properties);
    return record;
  } catch (error) {
    return null;
  }
}

function isValidQueuedEvent(event) {
  return readValidQueuedEvent(event) !== null;
}

function isAcknowledged(result) {
  const snapshot = isPlainObject(result)
    ? readExactDataProperties(result, ['acknowledged'])
    : null;
  return (
    result === true
    || (snapshot && snapshot.acknowledged === true)
  );
}

function getStorageCoordinator(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) {
    throw new TypeError('storage must be an object');
  }
  return EVENT_QUEUE_COORDINATOR;
}

function createEventTracker({ storage, transport, clock, idFactory, context }) {
  const safeContext = validateContext(context);
  const coordinator = getStorageCoordinator(storage);

  function serialize(operation) {
    const result = coordinator.operations.then(operation, operation);
    coordinator.operations = result.catch(() => undefined);
    return result;
  }

  function inspectQueueWindow(stored) {
    if (stored === undefined || stored === null) {
      return { validPrefix: [], stored: [], inspectedSlotCount: 0, changed: false };
    }
    if (!Array.isArray(stored)) {
      return { validPrefix: [], stored: [], inspectedSlotCount: 0, changed: true };
    }

    const validPrefix = [];
    const seenEventIds = new Set();
    let changed = false;
    const inspectedSlotCount = Math.min(stored.length, MAX_FLUSH_SIZE);
    for (let index = 0; index < inspectedSlotCount; index += 1) {
      const slotDescriptor = Object.getOwnPropertyDescriptor(stored, String(index));
      if (!slotDescriptor || !Object.hasOwn(slotDescriptor, 'value')) {
        changed = true;
        continue;
      }
      const event = slotDescriptor.value;
      const record = readValidQueuedEvent(event);
      if (
        !record
        || seenEventIds.has(record.eventId)
      ) {
        changed = true;
        continue;
      }
      seenEventIds.add(record.eventId);
      validPrefix.push({ event, eventId: record.eventId });
    }

    return {
      validPrefix,
      stored,
      inspectedSlotCount,
      changed,
    };
  }

  function queueContainsEventId(stored, eventId) {
    if (!Array.isArray(stored)) return false;
    for (let index = 0; index < stored.length; index += 1) {
      const slotDescriptor = Object.getOwnPropertyDescriptor(stored, String(index));
      if (!slotDescriptor || !Object.hasOwn(slotDescriptor, 'value')) continue;
      const event = slotDescriptor.value;
      if (!isPlainObject(event)) continue;
      if (readDataProperty(event, 'eventId') === eventId) return true;
    }
    return false;
  }

  function appendUncheckedTail(target, stored, startIndex) {
    const targetStart = target.length;
    const tailSlotCount = stored.length - startIndex;
    target.length = targetStart + tailSlotCount;
    for (let sourceIndex = startIndex; sourceIndex < stored.length; sourceIndex += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(stored, String(sourceIndex));
      if (!descriptor) continue;
      const targetIndex = targetStart + sourceIndex - startIndex;
      Object.defineProperty(target, String(targetIndex), descriptor);
    }
  }

  async function rewriteQueue({ removeEventIds = new Set(), appendEvent } = {}) {
    const stored = await storage.get(EVENT_QUEUE_KEY);
    const inspected = inspectQueueWindow(stored);
    const queue = [];
    let removedCount = 0;
    for (const entry of inspected.validPrefix) {
      if (removeEventIds.has(entry.eventId)) {
        removedCount += 1;
      } else {
        queue.push(entry.event);
      }
    }
    appendUncheckedTail(queue, inspected.stored, inspected.inspectedSlotCount);
    if (appendEvent) queue.push(appendEvent);

    if (inspected.changed || removedCount > 0 || appendEvent) {
      await storage.set(EVENT_QUEUE_KEY, queue);
    }
    return { queue, removedCount };
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

      return serialize(async () => {
        const rawEventId = idFactory();
        if (typeof rawEventId !== 'string' || !RAW_ID_PATTERN.test(rawEventId)) {
          throw new TypeError('invalid event id');
        }
        const eventId = `event_${rawEventId}`;
        const stored = await storage.get(EVENT_QUEUE_KEY);
        if (
          coordinator.reservedEventIds.has(eventId)
          || queueContainsEventId(stored, eventId)
        ) {
          throw new Error('duplicate event id');
        }

        const event = freezeRecord({
          eventId,
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
        coordinator.reservedEventIds.add(eventId);

        let acknowledged = false;
        try {
          acknowledged = isAcknowledged(await transport(event));
        } catch (error) {
          acknowledged = false;
        }
        if (!acknowledged) await rewriteQueue({ appendEvent: event });
        return event;
      });
    },

    flush() {
      return serialize(async () => {
        const stored = await storage.get(EVENT_QUEUE_KEY);
        const inspected = inspectQueueWindow(stored);
        const batch = inspected.validPrefix;

        const acknowledgedPrefixIds = new Set();
        for (const entry of batch) {
          if (!coordinator.acknowledgedEventIds.has(entry.eventId)) break;
          acknowledgedPrefixIds.add(entry.eventId);
        }
        if (acknowledgedPrefixIds.size > 0) {
          await rewriteQueue({ removeEventIds: acknowledgedPrefixIds });
          for (const eventId of acknowledgedPrefixIds) {
            coordinator.acknowledgedEventIds.delete(eventId);
          }
          return acknowledgedPrefixIds.size;
        }

        let acknowledgedCount = 0;
        const acknowledgedIds = new Set();
        for (const entry of batch) {
          try {
            if (!isAcknowledged(await transport(entry.event))) break;
            acknowledgedCount += 1;
            acknowledgedIds.add(entry.eventId);
            coordinator.acknowledgedEventIds.add(entry.eventId);
          } catch (error) {
            break;
          }
        }

        if (acknowledgedCount > 0 || inspected.changed) {
          await rewriteQueue({ removeEventIds: acknowledgedIds });
          for (const eventId of acknowledgedIds) {
            coordinator.acknowledgedEventIds.delete(eventId);
          }
        }
        return acknowledgedCount;
      });
    },
  };
}

module.exports = { createEventTracker, DELIVERY_SEMANTICS, EVENT_CONTRACT };
