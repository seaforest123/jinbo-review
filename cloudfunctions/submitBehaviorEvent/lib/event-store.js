'use strict';

const crypto = require('node:crypto');

const EVENT_ID_PATTERN = /^event_[a-f0-9]{16,64}$/;

function sortCanonicalValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (!value || typeof value !== 'object') throw new TypeError('invalid canonical event value');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('invalid canonical event value');
  }
  const sorted = {};
  for (const key of Reflect.ownKeys(value).sort()) {
    if (typeof key !== 'string') throw new TypeError('invalid canonical event key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('invalid canonical event property');
    }
    sorted[key] = sortCanonicalValue(descriptor.value);
  }
  return sorted;
}

function canonicalizeEvent(event) {
  return JSON.stringify(sortCanonicalValue(event));
}

function hashCanonicalPayload(event) {
  return crypto.createHash('sha256').update(canonicalizeEvent(event)).digest('hex');
}

function readDataProperty(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function readStoredEvent(value, eventId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid stored event');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('invalid stored event');
  }
  const keys = Reflect.ownKeys(value);
  const allowedKeys = new Set(['_id', 'envelope', 'payloadHash']);
  if (
    !Object.hasOwn(value, 'envelope')
    || !Object.hasOwn(value, 'payloadHash')
    || keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))
  ) {
    throw new Error('invalid stored event');
  }
  const envelope = readDataProperty(value, 'envelope');
  const payloadHash = readDataProperty(value, 'payloadHash');
  const storedId = Object.hasOwn(value, '_id') ? readDataProperty(value, '_id') : eventId;
  if (
    storedId !== eventId
    || typeof payloadHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(payloadHash)
  ) {
    throw new Error('invalid stored event');
  }
  return { envelope, payloadHash };
}

function createBehaviorEventStore({ database }) {
  if (!database || typeof database.runTransaction !== 'function') {
    throw new TypeError('transactional database is required');
  }
  return Object.freeze({
    async submit(envelope) {
      const eventId = readDataProperty(envelope, 'eventId');
      if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
        throw new TypeError('invalid eventId');
      }
      const canonicalPayload = canonicalizeEvent(envelope);
      const payloadHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
      await database.runTransaction(async (transaction) => {
        const document = transaction.collection('behavior_events').doc(eventId);
        const existingResult = await document.get();
        const existing = existingResult && existingResult.data;
        if (existing) {
          const stored = readStoredEvent(existing, eventId);
          let storedCanonicalPayload;
          try {
            storedCanonicalPayload = canonicalizeEvent(stored.envelope);
          } catch (error) {
            throw new Error('invalid stored event');
          }
          if (
            stored.payloadHash !== payloadHash
            || storedCanonicalPayload !== canonicalPayload
            || hashCanonicalPayload(stored.envelope) !== stored.payloadHash
          ) {
            throw new Error('eventId conflict');
          }
          return;
        }
        await document.set({ data: { envelope, payloadHash } });
      });
      return { acknowledged: true };
    },
  });
}

module.exports = { canonicalizeEvent, hashCanonicalPayload, createBehaviorEventStore };
