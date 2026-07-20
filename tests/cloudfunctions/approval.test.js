'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAuthorizedReviewer,
  validateExistingRoute,
  buildConfirmedRoute,
} = require('../../cloudfunctions/confirmRoute/lib/approval');
const { validateRoute } = require('../../miniprogram/domain/route-config');

const REVIEWER_ID = `anon_${'a'.repeat(32)}`;
const SERVER_DATE = Object.freeze({ $date: 'server' });

function confirmedRouteReplacement(overrides = {}) {
  return {
    displayName: '制箔工艺路线',
    banner: '专业审核通过的制箔数字体验',
    steps: [
      { id: 'observe', order: 1, adapter: 'select', title: '认识制箔材料与工具' },
      { id: 'motion', order: 2, adapter: 'continuous-drag', title: '体验关键制箔动作' },
      { id: 'inspect', order: 3, adapter: 'inspect', title: '观察并检查金箔效果' },
    ],
    ...overrides,
  };
}

function reviewedContent(overrides = {}) {
  return {
    _id: 'content-foil-making',
    routeId: 'foil_making_candidate',
    contentVersion: 'content-v2',
    allowedEnvironment: 'trial',
    reviewStatus: 'reviewed',
    confirmedRoute: confirmedRouteReplacement(),
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

test('existing placeholder contributes only stable route policy fields', () => {
  assert.deepEqual(validateExistingRoute(candidateRoute(), 'foil_making_candidate'), {
    id: 'foil_making_candidate',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
  });
});

test('uses reviewed replacement copy instead of placeholder copy in a client-valid confirmed route', () => {
  const existingRoute = candidateRoute();
  const replacement = confirmedRouteReplacement();
  const confirmed = buildConfirmedRoute(
    { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
    reviewedContent({ confirmedRoute: replacement }),
    existingRoute,
    approvalAudit(),
  );

  assert.deepEqual(confirmed, {
    id: 'foil_making_candidate',
    displayName: replacement.displayName,
    status: 'confirmed',
    reviewStatus: 'internal_approved',
    allowedEnvironment: 'trial',
    allowedEnvironments: ['development', 'trial'],
    banner: replacement.banner,
    steps: replacement.steps,
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
  assert.notEqual(confirmed.displayName, existingRoute.displayName);
  assert.notEqual(confirmed.banner, existingRoute.banner);
  assert.notEqual(confirmed.steps, existingRoute.steps);
  assert.doesNotMatch(
    JSON.stringify(confirmed),
    /候选示意|尚未经专业确认|待专业确认|内部测试|internal_placeholder/i,
  );
});

test('accepts related professional copy without applying loose marker substrings', () => {
  const confirmed = buildConfirmedRoute(
    { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
    reviewedContent({
      confirmedRoute: confirmedRouteReplacement({
        displayName: '候选纹样研究成果',
        banner: '内容已经专业确认并完成审核',
        steps: [
          { id: 'observe', order: 1, adapter: 'select', title: '认识制箔材料与工具' },
          { id: 'motion', order: 2, adapter: 'continuous-drag', title: '体验关键制箔动作' },
          { id: 'inspect', order: 3, adapter: 'inspect', title: '记录 preinternal_placeholderpost 术语' },
        ],
      }),
    }),
    candidateRoute(),
    approvalAudit(),
  );

  assert.equal(validateRoute(confirmed).status, 'confirmed');
});

test('rejects missing, malformed, and out-of-bounds confirmed route replacements', () => {
  const validSteps = confirmedRouteReplacement().steps;
  const invalidReplacements = [
    undefined,
    null,
    [],
    { displayName: '制箔工艺路线', banner: '专业审核内容' },
    { ...confirmedRouteReplacement(), extra: true },
    confirmedRouteReplacement({ displayName: 1 }),
    confirmedRouteReplacement({ displayName: '' }),
    confirmedRouteReplacement({ displayName: '名'.repeat(81) }),
    confirmedRouteReplacement({ banner: ' ' }),
    confirmedRouteReplacement({ banner: '文'.repeat(201) }),
    confirmedRouteReplacement({ steps: validSteps.slice(0, 2) }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => ({ ...step, order: index === 2 ? 2 : step.order })),
    }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => ({ ...step, id: index === 2 ? 'observe' : step.id })),
    }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => (
        index === 0 ? { ...step, adapter: 'unknown' } : step
      )),
    }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => (
        index === 0 ? { ...step, id: 'x'.repeat(65) } : step
      )),
    }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => (
        index === 0 ? { ...step, title: '文'.repeat(121) } : step
      )),
    }),
    confirmedRouteReplacement({
      steps: validSteps.map((step, index) => (
        index === 0 ? { ...step, extra: true } : step
      )),
    }),
  ];

  for (const confirmedRoute of invalidReplacements) {
    assert.throws(
      () => buildConfirmedRoute(
        { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' },
        reviewedContent({ confirmedRoute }),
        candidateRoute(),
        approvalAudit(),
      ),
      /confirmed route|replacement|display|banner|step/i,
    );
  }
});

test('rejects replacement accessors, symbols, dangerous keys, and prototype edge cases', () => {
  const candidate = { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' };
  let getterReads = 0;
  const accessorReplacement = confirmedRouteReplacement();
  Object.defineProperty(accessorReplacement, 'displayName', {
    enumerable: true,
    get() {
      getterReads += 1;
      return '不得读取';
    },
  });

  const accessorContent = reviewedContent();
  Object.defineProperty(accessorContent, 'confirmedRoute', {
    enumerable: true,
    get() {
      getterReads += 1;
      return confirmedRouteReplacement();
    },
  });

  const symbolReplacement = confirmedRouteReplacement();
  symbolReplacement[Symbol('unsafe')] = true;
  const inheritedReplacement = confirmedRouteReplacement();
  Object.setPrototypeOf(inheritedReplacement, { inherited: true });
  const dangerousReplacements = ['__proto__', 'prototype', 'constructor'].map((key) => {
    const replacement = confirmedRouteReplacement();
    Object.defineProperty(replacement, key, { enumerable: true, value: 'forbidden' });
    return replacement;
  });
  const accessorSteps = [...confirmedRouteReplacement().steps];
  Object.defineProperty(accessorSteps, 0, {
    enumerable: true,
    get() {
      getterReads += 1;
      return confirmedRouteReplacement().steps[0];
    },
  });
  const extraArrayKeySteps = [...confirmedRouteReplacement().steps];
  extraArrayKeySteps.extra = true;
  const symbolStep = { ...confirmedRouteReplacement().steps[0] };
  symbolStep[Symbol('unsafe')] = true;
  const accessorStep = { ...confirmedRouteReplacement().steps[0] };
  Object.defineProperty(accessorStep, 'title', {
    enumerable: true,
    get() {
      getterReads += 1;
      return '不得读取';
    },
  });
  const inheritedStep = { ...confirmedRouteReplacement().steps[0] };
  Object.setPrototypeOf(inheritedStep, { inherited: true });
  const dangerousStep = { ...confirmedRouteReplacement().steps[0] };
  Object.defineProperty(dangerousStep, 'constructor', {
    enumerable: true,
    value: 'forbidden',
  });
  const inheritedSteps = [...confirmedRouteReplacement().steps];
  Object.setPrototypeOf(inheritedSteps, { inherited: true });

  const invalidContents = [
    reviewedContent({ confirmedRoute: accessorReplacement }),
    accessorContent,
    reviewedContent({ confirmedRoute: symbolReplacement }),
    reviewedContent({ confirmedRoute: inheritedReplacement }),
    ...dangerousReplacements.map((confirmedRoute) => reviewedContent({ confirmedRoute })),
    reviewedContent({ confirmedRoute: confirmedRouteReplacement({ steps: accessorSteps }) }),
    reviewedContent({ confirmedRoute: confirmedRouteReplacement({ steps: extraArrayKeySteps }) }),
    reviewedContent({ confirmedRoute: confirmedRouteReplacement({ steps: inheritedSteps }) }),
    reviewedContent({
      confirmedRoute: confirmedRouteReplacement({
        steps: [symbolStep, ...confirmedRouteReplacement().steps.slice(1)],
      }),
    }),
    reviewedContent({
      confirmedRoute: confirmedRouteReplacement({
        steps: [accessorStep, ...confirmedRouteReplacement().steps.slice(1)],
      }),
    }),
    reviewedContent({
      confirmedRoute: confirmedRouteReplacement({
        steps: [inheritedStep, ...confirmedRouteReplacement().steps.slice(1)],
      }),
    }),
    reviewedContent({
      confirmedRoute: confirmedRouteReplacement({
        steps: [dangerousStep, ...confirmedRouteReplacement().steps.slice(1)],
      }),
    }),
  ];

  for (const contentItem of invalidContents) {
    assert.throws(
      () => buildConfirmedRoute(candidate, contentItem, candidateRoute(), approvalAudit()),
      /confirmed route|replacement|property|step/i,
    );
  }
  assert.equal(getterReads, 0);
});

test('rejects exact placeholder and internal-only markers in replacement display text', () => {
  const markers = [
    '候选示意',
    '尚未经专业确认',
    '待专业确认',
    '内部测试',
    'INTERNAL_PLACEHOLDER',
  ];
  const candidate = { routeId: 'foil_making_candidate', contentItemId: 'content-foil-making' };

  for (const marker of markers) {
    for (const confirmedRoute of [
      confirmedRouteReplacement({ displayName: `制箔路线 ${marker}` }),
      confirmedRouteReplacement({ banner: `制箔体验 ${marker}` }),
      confirmedRouteReplacement({
        steps: confirmedRouteReplacement().steps.map((step, index) => (
          index === 1 ? { ...step, title: `体验动作 ${marker}` } : step
        )),
      }),
    ]) {
      assert.throws(
        () => buildConfirmedRoute(
          candidate,
          reviewedContent({ confirmedRoute }),
          candidateRoute(),
          approvalAudit(),
        ),
        /placeholder|internal|marker|confirmed route|replacement/i,
      );
    }
  }
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
