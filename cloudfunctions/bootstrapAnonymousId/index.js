'use strict';

const cloud = require('wx-server-sdk');
const { adaptCloudBaseRequest } = require('./lib/cloudbase-request');
const { hashIdentity } = require('./lib/hash-identity');
const { createBootstrapAnonymousIdHandler } = require('./lib/handler');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const handler = createBootstrapAnonymousIdHandler({
  getWXContext: () => cloud.getWXContext(),
  environment: process.env,
  hashIdentity,
});

exports.main = (event) => handler(adaptCloudBaseRequest(event));
