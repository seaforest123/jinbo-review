'use strict';

const cloud = require('wx-server-sdk');
const { hashIdentity } = require('./lib/hash-identity');
const { validateEventEnvelope } = require('./lib/event-schema');
const { createBehaviorEventStore } = require('./lib/event-store');
const { createSubmitBehaviorEventHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const database = cloud.database();

exports.main = createSubmitBehaviorEventHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
  validateEventEnvelope,
  store: createBehaviorEventStore({ database, validateEventEnvelope }),
});
