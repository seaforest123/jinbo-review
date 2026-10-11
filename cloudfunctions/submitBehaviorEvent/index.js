'use strict';

const cloud = require('wx-server-sdk');
const { adaptCloudBaseRequest } = require('./lib/cloudbase-request');
const { hashIdentity } = require('./lib/hash-identity');
const { validateEventEnvelope } = require('./lib/event-schema');
const { createBehaviorEventStore } = require('./lib/event-store');
const { createSubmitBehaviorEventHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const database = cloud.database();

const handler = createSubmitBehaviorEventHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
  validateEventEnvelope,
  store: createBehaviorEventStore({ database, validateEventEnvelope }),
});

exports.main = (event) => handler(adaptCloudBaseRequest(event));
