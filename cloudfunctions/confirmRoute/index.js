'use strict';

const cloud = require('wx-server-sdk');
const { adaptCloudBaseRequest } = require('./lib/cloudbase-request');
const { hashIdentity } = require('./lib/hash-identity');
const { createConfirmRouteHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const database = cloud.database();

const handler = createConfirmRouteHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
  database,
  serverDate: () => database.serverDate(),
});

exports.main = (event) => handler(adaptCloudBaseRequest(event));
