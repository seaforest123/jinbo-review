'use strict';

const crypto = require('node:crypto');

function requireNonBlank(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-blank string`);
  }
}

function hashIdentity(openid, salt) {
  requireNonBlank(openid, 'identity');
  if (typeof salt !== 'string' || salt.trim().length < 32) {
    throw new TypeError('salt must contain at least 32 non-whitespace characters');
  }
  const digest = crypto.createHmac('sha256', salt).update(openid).digest('hex');
  return `anon_${digest.slice(0, 32)}`;
}

module.exports = { hashIdentity };
