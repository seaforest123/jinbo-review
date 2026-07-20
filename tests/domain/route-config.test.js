const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRoute, getVisibleRoutes } = require('../../miniprogram/domain/route-config');

const valid = {
  id: 'foil_making_candidate',
  displayName: '制箔候选路线',
  status: 'internal_placeholder',
  reviewStatus: 'internal_approved',
  allowedEnvironments: ['development', 'trial'],
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
