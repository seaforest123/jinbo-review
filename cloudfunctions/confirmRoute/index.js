'use strict';

const cloud = require('wx-server-sdk');
const { hashIdentity } = require('./lib/hash-identity');
const { createConfirmRouteHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const database = cloud.database();

exports.main = createConfirmRouteHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
  database,
  serverDate: () => database.serverDate(),
});
