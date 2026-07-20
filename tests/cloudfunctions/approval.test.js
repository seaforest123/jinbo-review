'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAuthorizedReviewer,
  buildConfirmedRoute,
} = require('../../cloudfunctions/confirmRoute/lib/approval');

const REVIEWER_ID = `anon_${'a'.repeat(32)}`;
const SERVER_DATE = Object.freeze({ $date: 'server' });

function reviewedContent(overrides = {}) {
  return {
    _id: 'content-foil-making',
    routeId: 'foil_making_candidate',
    contentVersion: 'content-v2',
    allowedEnvironment: 'trial',
    reviewStatus: 'reviewed',
    ...overrides,
  };
}

test('authorizes only an explicitly listed opaque reviewer ID', () => {
  assert.equal(isAuthorizedReviewer(REVIEWER_ID, [REVIEWER_ID]), true);
  assert.equal(isAuthorizedReviewer(REVIEWER_ID, []), false);
  assert.equal(isAuthorizedReviewer(REVIEWER_ID, [`anon_${'b'.repeat(32)}`]), false);
  assert.equal(isAuthorizedReviewer('trusted-openid', ['trusted-openid']), false);
  assert.equal(isAuthorizedReviewer(REVIEWER_ID, `${REVIEWER_ID},other`), false);
});

test('builds the bounded trial route from a matching reviewed content item', () => {
  assert.deepEqual(
    buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
      reviewedContent(),
      { reviewerAnonymousId: REVIEWER_ID, approvedAt: SERVER_DATE },
    ),
    {
      routeId: 'foil_making_candidate',
      contentItemId: 'content-foil-making',
      contentVersion: 'content-v2',
      allowedEnvironment: 'trial',
      reviewStatus: 'reviewed',
      approvalAudit: {
        reviewerAnonymousId: REVIEWER_ID,
        approvedAt: SERVER_DATE,
        contentItemId: 'content-foil-making',
        contentVersion: 'content-v2',
      },
    },
  );
});

test('rejects unreviewed, cross-route, mismatched, and production content', () => {
  const candidate = { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' };
  const invalidItems = [
    reviewedContent({ reviewStatus: 'internal_approved' }),
    reviewedContent({ reviewStatus: 'published' }),
    reviewedContent({ routeId: 'foil_application_candidate' }),
    reviewedContent({ _id: 'different-content' }),
    reviewedContent({ allowedEnvironment: 'production' }),
    reviewedContent({ allowedEnvironment: ['trial', 'production'] }),
    reviewedContent({ contentVersion: '' }),
    reviewedContent({ contentVersion: 2 }),
    reviewedContent({ contentVersion: ' content-v2 ' }),
    reviewedContent({ contentVersion: 'content/version' }),
  ];

  for (const contentItem of invalidItems) {
    assert.throws(
      () => buildConfirmedRoute(candidate, contentItem, {
        reviewerAnonymousId: REVIEWER_ID,
        approvedAt: SERVER_DATE,
      }),
      /route|content|review|trial|version/i,
    );
  }
});

test('requires an anonymous reviewer and a server timestamp audit value', () => {
  const candidate = { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' };
  for (const audit of [
    undefined,
    { reviewerAnonymousId: 'trusted-openid', approvedAt: SERVER_DATE },
    { reviewerAnonymousId: REVIEWER_ID },
    { reviewerAnonymousId: REVIEWER_ID, approvedAt: null },
    { reviewerAnonymousId: REVIEWER_ID, approvedAt: [] },
    { reviewerAnonymousId: REVIEWER_ID, approvedAt() {} },
    { reviewerAnonymousId: REVIEWER_ID, approvedAt: SERVER_DATE, rawReviewer: 'forbidden' },
  ]) {
    assert.throws(
      () => buildConfirmedRoute(candidate, reviewedContent(), audit),
      /audit|reviewer|timestamp/i,
    );
  }
});

test('rejects unknown candidate request fields and unsupported route IDs', () => {
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making', production: false },
      reviewedContent(),
      { reviewerAnonymousId: REVIEWER_ID, approvedAt: SERVER_DATE },
    ),
    /candidate/i,
  );
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'unreviewed_route', contentItemId: 'content-foil-making' },
      reviewedContent(),
      { reviewerAnonymousId: REVIEWER_ID, approvedAt: SERVER_DATE },
    ),
    /route/i,
  );
});
