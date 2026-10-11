'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const implementations = [
  ['bootstrapAnonymousId', '../../cloudfunctions/bootstrapAnonymousId/lib/hash-identity'],
  ['confirmRoute', '../../cloudfunctions/confirmRoute/lib/hash-identity'],
  ['submitBehaviorEvent', '../../cloudfunctions/submitBehaviorEvent/lib/hash-identity'],
];
const STRONG_SALT = 's'.repeat(32);
const DIFFERENT_STRONG_SALT = 't'.repeat(32);

test('hashes a trusted identity deterministically into the required opaque shape', () => {
  for (const [name, modulePath] of implementations) {
    const { hashIdentity } = require(modulePath);
    const first = hashIdentity('trusted-openid', STRONG_SALT);
    const replay = hashIdentity('trusted-openid', STRONG_SALT);

    assert.match(first, /^anon_[a-f0-9]{32}$/, name);
    assert.equal(replay, first, name);
    assert.notEqual(hashIdentity('trusted-openid', DIFFERENT_STRONG_SALT), first, name);
  }
});

test('keeps the independently deployed identity hash implementations in sync', () => {
  const hashes = implementations.map(([, modulePath]) => (
    require(modulePath).hashIdentity('trusted-openid', STRONG_SALT)
  ));

  assert.equal(new Set(hashes).size, 1);
});

test('rejects blank trusted identities and salts shorter than 32 characters', () => {
  for (const [, modulePath] of implementations) {
    const { hashIdentity } = require(modulePath);
    for (const [openid, salt] of [
      ['', STRONG_SALT],
      ['   ', STRONG_SALT],
      ['openid', ''],
      ['openid', '   '],
      ['openid', 's'.repeat(31)],
      ['openid', ` ${'s'.repeat(30)} `],
      [undefined, STRONG_SALT],
      ['openid', undefined],
    ]) {
      assert.throws(() => hashIdentity(openid, salt), /identity|salt/i);
    }
  }
});
