'use strict';

const cloud = require('wx-server-sdk');
const { hashIdentity } = require('./lib/hash-identity');
const { createBootstrapAnonymousIdHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = createBootstrapAnonymousIdHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
});
