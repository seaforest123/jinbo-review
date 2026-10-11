'use strict';

const APP_ID_PATTERN = /^wx[a-f0-9]{16}$/;
const ANONYMOUS_ID_PATTERN = /^anon_[a-f0-9]{32}$/;

function readOwnDataProperty(value, key) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function readEnvironmentString(environment, key) {
  const value = readOwnDataProperty(environment, key);
  return typeof value === 'string' ? value : undefined;
}

function resolveTrustedAnonymousId({ getWXContext, environment, hashIdentity }) {
  if (typeof getWXContext !== 'function' || typeof hashIdentity !== 'function') {
    throw new TypeError('invalid trusted context dependencies');
  }
  const salt = readEnvironmentString(environment, 'ANONYMIZATION_SALT');
  if (typeof salt !== 'string' || salt.trim().length < 32) {
    throw new TypeError('ANONYMIZATION_SALT must contain at least 32 non-whitespace characters');
  }
  const expectedAppId = readEnvironmentString(environment, 'WECHAT_APP_ID');
  if (typeof expectedAppId !== 'string' || !APP_ID_PATTERN.test(expectedAppId)) {
    throw new TypeError('WECHAT_APP_ID must be a strict mini-program AppID');
  }

  const wxContext = getWXContext();
  const trustedIdentity = readOwnDataProperty(wxContext, 'OPENID');
  const trustedAppId = readOwnDataProperty(wxContext, 'APPID');
  if (
    typeof trustedIdentity !== 'string'
    || trustedIdentity.trim() === ''
    || typeof trustedAppId !== 'string'
    || trustedAppId !== expectedAppId
  ) {
    throw new TypeError('trusted mini-program APPID context is required');
  }
  return hashIdentity(trustedIdentity, salt);
}

function readApproverIds(environment) {
  const configured = readEnvironmentString(environment, 'APPROVER_IDS');
  if (typeof configured !== 'string' || configured.trim() === '') {
    throw new TypeError('APPROVER_IDS must be a nonempty reviewer list');
  }
  const reviewerIds = configured.split(',').map((value) => value.trim());
  if (
    reviewerIds.some((value) => value === '' || !ANONYMOUS_ID_PATTERN.test(value))
    || new Set(reviewerIds).size !== reviewerIds.length
  ) {
    throw new TypeError('APPROVER_IDS must contain unique anonymous reviewers without empty entries');
  }
  return Object.freeze(reviewerIds);
}

module.exports = { resolveTrustedAnonymousId, readApproverIds };
