const test = require('node:test');
const assert = require('node:assert/strict');
const candidateRoutes = require('../../miniprogram/data/routes');
const { RouteConfigError, validateRoute, getVisibleRoutes } = require('../../miniprogram/domain/route-config');

const valid = {
  id: 'foil_making_candidate',
  displayName: '制箔候选路线',
  status: 'internal_placeholder',
  reviewStatus: 'internal_approved',
  allowedEnvironments: ['development', 'trial'],
  banner: '候选示意，尚未经专业确认',
  steps: [
    { id: 'observe', order: 1, adapter: 'select', title: '认识材料与目标（候选示意）' },
    { id: 'motion', order: 2, adapter: 'continuous-drag', title: '模拟关键动作（候选示意）' },
    { id: 'inspect', order: 3, adapter: 'inspect', title: '检查数字结果（候选示意）' },
  ],
};

test('accepts exactly three ordered internal candidate steps', () => {
  assert.equal(validateRoute(valid).steps.length, 3);
});

test('rejects a route with duplicate or unordered step order', () => {
  const bad = { ...valid, steps: valid.steps.map((step) => ({ ...step, order: 1 })) };
  assert.throws(() => validateRoute(bad), /步骤顺序必须是 1,2,3/);
});

test('hides internal candidates from production', () => {
  assert.equal(getVisibleRoutes([valid], 'production').length, 0);
  assert.equal(getVisibleRoutes([valid], 'trial').length, 1);
});

test('hides non-confirmed routes from production even when their environment list includes it', () => {
  const productionMismatches = ['internal_placeholder', 'candidate'].map((status) => ({
    ...valid,
    status,
    allowedEnvironments: ['production'],
  }));
  const confirmed = { ...valid, id: 'confirmed_route', status: 'confirmed', allowedEnvironments: ['production'] };

  assert.deepEqual(getVisibleRoutes([...productionMismatches, confirmed], 'production').map((route) => route.id), ['confirmed_route']);
});

test('rejects missing route fields and invalid route-level values with RouteConfigError', () => {
  const invalidRoutes = [
    { ...valid, displayName: '' },
    { ...valid, banner: '' },
    { ...valid, reviewStatus: 'unreviewed' },
    { ...valid, allowedEnvironments: [] },
    { ...valid, allowedEnvironments: ['trial', 'trial'] },
    { ...valid, allowedEnvironments: ['staging'] },
  ];

  for (const route of invalidRoutes) assert.throws(() => validateRoute(route), RouteConfigError);
});

test('rejects incomplete step objects with RouteConfigError', () => {
  const invalidSteps = [
    null,
    { ...valid.steps[0], id: '' },
    { ...valid.steps[0], title: '' },
    { ...valid.steps[0], order: undefined },
    { ...valid.steps[0], adapter: '' },
  ];

  for (const step of invalidSteps) {
    const route = { ...valid, steps: [step, valid.steps[1], valid.steps[2]] };
    assert.throws(() => validateRoute(route), RouteConfigError);
  }
});

test('deep-freezes validated routes and the exported candidate collection without sharing mutable arrays', () => {
  const validated = validateRoute(valid);
  assert.ok(Object.isFrozen(validated.allowedEnvironments));
  assert.ok(Object.isFrozen(validated.steps));
  assert.ok(Object.isFrozen(validated.steps[0]));
  assert.throws(() => validated.allowedEnvironments.push('production'), TypeError);
  assert.throws(() => validated.steps.push({}), TypeError);
  assert.throws(() => { 'use strict'; validated.steps[0].title = 'changed'; }, TypeError);
  assert.equal(validated.steps[0].title, valid.steps[0].title);

  assert.ok(Object.isFrozen(candidateRoutes));
  assert.notStrictEqual(candidateRoutes[0].allowedEnvironments, candidateRoutes[1].allowedEnvironments);
  assert.notStrictEqual(candidateRoutes[0].steps, candidateRoutes[1].steps);
  assert.throws(() => candidateRoutes[0].allowedEnvironments.push('production'), TypeError);
  assert.throws(() => candidateRoutes[0].steps.push({}), TypeError);
});
