'use strict';

const crypto = require('node:crypto');

const EVENT_ID_PATTERN = /^event_[a-f0-9]{16,64}$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function buildCanonicalValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(buildCanonicalValue);
  if (!value || typeof value !== 'object') throw new TypeError('invalid canonical event value');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('invalid canonical event value');
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || DANGEROUS_KEYS.has(key))) {
    throw new TypeError('invalid canonical event key');
  }
  const sorted = Object.create(null);
  for (const key of keys.sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('invalid canonical event property');
    }
    sorted[key] = buildCanonicalValue(descriptor.value);
  }
  return sorted;
}

function canonicalizeEvent(event) {
  return JSON.stringify(buildCanonicalValue(event));
}

function hashCanonicalPayload(event) {
  return crypto.createHash('sha256').update(canonicalizeEvent(event)).digest('hex');
}

function readDataProperty(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function isMissingDocumentError(error, eventId) {
  return readDataProperty(error, 'message')
    === `document.get:fail document with _id ${eventId} does not exist`;
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

function createBehaviorEventStore({ database, validateEventEnvelope }) {
  if (
    !database
    || typeof database.runTransaction !== 'function'
    || typeof validateEventEnvelope !== 'function'
  ) {
    throw new TypeError('transactional database and event validator are required');
  }
  return Object.freeze({
    async submit(envelope) {
      const normalizedEnvelope = validateEventEnvelope(envelope);
      const eventId = readDataProperty(normalizedEnvelope, 'eventId');
      if (typeof eventId !== 'string' || !EVENT_ID_PATTERN.test(eventId)) {
        throw new TypeError('invalid eventId');
      }
      const canonicalPayload = canonicalizeEvent(normalizedEnvelope);
      const payloadHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');
      await database.runTransaction(async (transaction) => {
        const document = transaction.collection('behavior_events').doc(eventId);
        let existingResult;
        try {
          existingResult = await document.get();
        } catch (error) {
          if (!isMissingDocumentError(error, eventId)) throw error;
          existingResult = null;
        }
        const existing = existingResult && existingResult.data;
        if (existing) {
          const stored = readStoredEvent(existing, eventId);
          let normalizedStoredEnvelope;
          let storedCanonicalPayload;
          try {
            normalizedStoredEnvelope = validateEventEnvelope(stored.envelope);
            storedCanonicalPayload = canonicalizeEvent(normalizedStoredEnvelope);
          } catch (error) {
            throw new Error('invalid stored event');
          }
          if (
            stored.payloadHash !== payloadHash
            || storedCanonicalPayload !== canonicalPayload
            || hashCanonicalPayload(normalizedStoredEnvelope) !== stored.payloadHash
          ) {
            throw new Error('eventId conflict');
          }
          return;
        }
        await document.set({ data: { envelope: normalizedEnvelope, payloadHash } });
      });
      return { acknowledged: true };
    },
  });
}

module.exports = {
  buildCanonicalValue,
  canonicalizeEvent,
  hashCanonicalPayload,
  createBehaviorEventStore,
};
