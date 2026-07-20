'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const implementations = [
  ['bootstrapAnonymousId', '../../cloudfunctions/bootstrapAnonymousId/lib/hash-identity'],
  ['confirmRoute', '../../cloudfunctions/confirmRoute/lib/hash-identity'],
  ['submitBehaviorEvent', '../../cloudfunctions/submitBehaviorEvent/lib/hash-identity'],
];

test('hashes a trusted identity deterministically into the required opaque shape', () => {
  for (const [name, modulePath] of implementations) {
    const { hashIdentity } = require(modulePath);
    const first = hashIdentity('trusted-openid', 'trial-salt');
    const replay = hashIdentity('trusted-openid', 'trial-salt');

    assert.match(first, /^anon_[a-f0-9]{32}$/, name);
    assert.equal(replay, first, name);
    assert.notEqual(hashIdentity('trusted-openid', 'different-salt'), first, name);
  }
});

test('keeps the independently deployed identity hash implementations in sync', () => {
  const hashes = implementations.map(([, modulePath]) => (
    require(modulePath).hashIdentity('trusted-openid', 'trial-salt')
  ));

  assert.equal(new Set(hashes).size, 1);
});

test('rejects blank trusted identities and salts', () => {
  for (const [, modulePath] of implementations) {
    const { hashIdentity } = require(modulePath);
    for (const [openid, salt] of [
      ['', 'salt'],
      ['   ', 'salt'],
      ['openid', ''],
      ['openid', '   '],
      [undefined, 'salt'],
      ['openid', undefined],
    ]) {
      assert.throws(() => hashIdentity(openid, salt), /identity|salt/i);
    }
  }
});
