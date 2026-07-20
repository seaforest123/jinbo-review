'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAuthorizedReviewer,
  buildConfirmedRoute,
} = require('../../cloudfunctions/confirmRoute/lib/approval');
const { validateRoute } = require('../../miniprogram/domain/route-config');

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

function candidateRoute(overrides = {}) {
  return {
    _id: 'foil_making_candidate',
    id: 'foil_making_candidate',
    displayName: '制箔候选路线',
    status: 'internal_placeholder',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
    banner: '候选示意，尚未经专业确认',
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
    ],
    ...overrides,
  };
}

function approvalAudit(overrides = {}) {
  return {
    reviewerAnonymousId: REVIEWER_ID,
    approvedAt: SERVER_DATE,
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

test('preserves the complete P0 route contract and produces a client-valid confirmed route', () => {
  const existingRoute = candidateRoute();
  const confirmed = buildConfirmedRoute(
    { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
    reviewedContent(),
    existingRoute,
    approvalAudit(),
  );

  assert.deepEqual(confirmed, {
    id: 'foil_making_candidate',
    displayName: existingRoute.displayName,
    status: 'confirmed',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
    banner: existingRoute.banner,
    steps: existingRoute.steps,
    contentItemId: 'content-foil-making',
    contentVersion: 'content-v2',
    approvalAudit: {
      reviewerAnonymousId: REVIEWER_ID,
      approvedAt: SERVER_DATE,
      contentItemId: 'content-foil-making',
      contentVersion: 'content-v2',
    },
  });
  assert.equal(validateRoute(confirmed).status, 'confirmed');
  assert.equal(confirmed.reviewStatus, 'internal_approved');
  assert.equal(confirmed.allowedEnvironment, 'trial');
  assert.notEqual(confirmed.allowedEnvironments, existingRoute.allowedEnvironments);
  assert.notEqual(confirmed.steps, existingRoute.steps);
});

test('fails closed for missing, malformed, wrong, or non-placeholder route documents', () => {
  const candidate = { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' };
  const malformedRoutes = [
    undefined,
    null,
    candidateRoute({ _id: 'foil_application_candidate' }),
    candidateRoute({ id: 'foil_application_candidate' }),
    candidateRoute({ status: 'candidate' }),
    candidateRoute({ status: 'confirmed' }),
    candidateRoute({ reviewStatus: 'reviewed' }),
    candidateRoute({ allowedEnvironment: 'production' }),
    candidateRoute({ allowedEnvironments: ['development', 'production'] }),
    candidateRoute({ displayName: '' }),
    candidateRoute({ banner: '' }),
    candidateRoute({ steps: candidateRoute().steps.slice(0, 2) }),
    candidateRoute({ rawOpenid: 'forbidden' }),
  ];

  for (const existingRoute of malformedRoutes) {
    assert.throws(
      () => buildConfirmedRoute(candidate, reviewedContent(), existingRoute, approvalAudit()),
      /route|config|placeholder|environment|field/i,
    );
  }
});

test('rejects route prototype and accessor edge cases without invoking hooks', () => {
  const inherited = Object.create(candidateRoute());
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
      reviewedContent(),
      inherited,
      approvalAudit(),
    ),
    /route|config/i,
  );

  let getterReads = 0;
  const accessorRoute = candidateRoute();
  Object.defineProperty(accessorRoute, 'displayName', {
    enumerable: true,
    get() {
      getterReads += 1;
      return '不得读取';
    },
  });
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
      reviewedContent(),
      accessorRoute,
      approvalAudit(),
    ),
    /route|config/i,
  );
  assert.equal(getterReads, 0);
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
      () => buildConfirmedRoute(candidate, contentItem, candidateRoute(), approvalAudit()),
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
      () => buildConfirmedRoute(candidate, reviewedContent(), candidateRoute(), audit),
      /audit|reviewer|timestamp/i,
    );
  }
});

test('rejects unknown candidate request fields and unsupported route IDs', () => {
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making', production: false },
      reviewedContent(),
      candidateRoute(),
      approvalAudit(),
    ),
    /candidate/i,
  );
  assert.throws(
    () => buildConfirmedRoute(
      { routeId: 'unreviewed_route', contentItemId: 'content-foil-making' },
      reviewedContent(),
      candidateRoute(),
      approvalAudit(),
    ),
    /route/i,
  );
});
