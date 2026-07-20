'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAuthorizedReviewer,
  buildConfirmedRoute,
} = require('../../cloudfunctions/confirmRoute/lib/approval');

const REVIEWER_ID = `anon_${'a'.repeat(32)}`;

function reviewedContent(overrides = {}) {
  return {
    _id: 'content-foil-making',
    routeId: 'foil_making_candidate',
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
    ),
    {
      routeId: 'foil_making_candidate',
      contentItemId: 'content-foil-making',
      allowedEnvironment: 'trial',
      reviewStatus: 'reviewed',
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
  ];

  for (const contentItem of invalidItems) {
    assert.throws(() => buildConfirmedRoute(candidate, contentItem), /route|content|review|trial/i);
  }
});

test('rejects unknown candidate request fields and unsupported route IDs', () => {
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making', production: false },
      reviewedContent(),
    ),
    /candidate/i,
  );
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'unreviewed_route', contentItemId: 'content-foil-making' },
      reviewedContent(),
    ),
    /route/i,
  );
});
