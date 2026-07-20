'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const functionNames = ['bootstrapAnonymousId', 'confirmRoute', 'submitBehaviorEvent'];
const APP_ID = `wx${'a'.repeat(16)}`;
const STRONG_SALT = 's'.repeat(32);
const ANONYMOUS_ID = `anon_${'a'.repeat(32)}`;

function loadSecurityContext(functionName) {
  return require(path.join(root, 'cloudfunctions', functionName, 'lib/security-context'));
}

test('keeps the independently deployed trusted-context implementations byte-identical', () => {
  const sources = functionNames.map((functionName) => fs.readFileSync(
    path.join(root, 'cloudfunctions', functionName, 'lib/security-context.js'),
    'utf8',
  ));
  assert.equal(new Set(sources).size, 1);
});

test('derives only an anonymous ID from matching trusted OPENID and APPID context', () => {
  for (const functionName of functionNames) {
    const { resolveTrustedAnonymousId } = loadSecurityContext(functionName);
    const calls = [];
    assert.equal(resolveTrustedAnonymousId({
      getWXContext: () => ({ OPENID: 'trusted-openid', APPID: APP_ID }),
      environment: { ANONYMIZATION_SALT: STRONG_SALT, WECHAT_APP_ID: APP_ID },
      hashIdentity: (...args) => {
        calls.push(args);
        return ANONYMOUS_ID;
      },
    }), ANONYMOUS_ID, functionName);
    assert.deepEqual(calls, [['trusted-openid', STRONG_SALT]], functionName);
  }
});

test('fails closed for missing or mismatched trusted APPID before hashing', () => {
  for (const functionName of functionNames) {
    const { resolveTrustedAnonymousId } = loadSecurityContext(functionName);
    for (const context of [
      { OPENID: 'trusted-openid' },
      { OPENID: 'trusted-openid', APPID: `wx${'b'.repeat(16)}` },
      { OPENID: 'trusted-openid', APPID: '' },
    ]) {
      let hashCalls = 0;
      assert.throws(() => resolveTrustedAnonymousId({
        getWXContext: () => context,
        environment: { ANONYMIZATION_SALT: STRONG_SALT, WECHAT_APP_ID: APP_ID },
        hashIdentity: () => {
          hashCalls += 1;
          return ANONYMOUS_ID;
        },
      }), /APPID|mini-program context/i, functionName);
      assert.equal(hashCalls, 0, functionName);
    }
  }
});

test('requires a strict configured AppID and at least 32 non-whitespace salt characters', () => {
  for (const functionName of functionNames) {
    const { resolveTrustedAnonymousId } = loadSecurityContext(functionName);
    const invalidEnvironments = [
      { ANONYMIZATION_SALT: 's'.repeat(31), WECHAT_APP_ID: APP_ID },
      { ANONYMIZATION_SALT: ` ${'s'.repeat(30)} `, WECHAT_APP_ID: APP_ID },
      { ANONYMIZATION_SALT: STRONG_SALT },
      { ANONYMIZATION_SALT: STRONG_SALT, WECHAT_APP_ID: 'wx123' },
      { ANONYMIZATION_SALT: STRONG_SALT, WECHAT_APP_ID: `wx${'A'.repeat(16)}` },
      { ANONYMIZATION_SALT: STRONG_SALT, WECHAT_APP_ID: ` ${APP_ID}` },
    ];
    for (const environment of invalidEnvironments) {
      assert.throws(() => resolveTrustedAnonymousId({
        getWXContext: () => ({ OPENID: 'trusted-openid', APPID: APP_ID }),
        environment,
        hashIdentity: () => ANONYMOUS_ID,
      }), /salt|WECHAT_APP_ID|APPID/i, functionName);
    }
  }
});

test('requires a nonempty, well-formed, duplicate-free APPROVER_IDS list', () => {
  const { readApproverIds } = loadSecurityContext('confirmRoute');
  const second = `anon_${'b'.repeat(32)}`;
  assert.deepEqual(readApproverIds({ APPROVER_IDS: `${ANONYMOUS_ID}, ${second}` }), [
    ANONYMOUS_ID,
    second,
  ]);
  for (const APPROVER_IDS of [
    undefined,
    '',
    '   ',
    `${ANONYMOUS_ID},`,
    `,${ANONYMOUS_ID}`,
    `${ANONYMOUS_ID},,${second}`,
    `${ANONYMOUS_ID},${ANONYMOUS_ID}`,
    `${ANONYMOUS_ID},trusted-openid`,
  ]) {
    assert.throws(() => readApproverIds({ APPROVER_IDS }), /APPROVER_IDS|reviewer/i);
  }
});
