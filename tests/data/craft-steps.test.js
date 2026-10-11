const test = require('node:test');
const assert = require('node:assert/strict');
const { CRAFT_SOURCE, listCraftSteps } = require('../../miniprogram/data/craft-steps');

test('provides an ordered twelve-step gold-foil process with a source note', () => {
  const steps = listCraftSteps();
  assert.equal(steps.length, 12);
  assert.deepEqual(steps.map((step) => step.order), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.equal(steps[9].name, '打了细');
  assert.match(steps[9].oneLiner, /约三万锤/);
  assert.equal(steps[10].name, '出具');
  assert.match(steps[10].oneLiner, /鹅毛/);
  assert.equal(steps[11].name, '切金箔');
  assert.match(steps[11].oneLiner, /竹刀/);
  assert.match(CRAFT_SOURCE, /赵绪成/);
});

test('returns independent craft-step records', () => {
  const first = listCraftSteps();
  first[0].name = 'changed';
  assert.equal(listCraftSteps()[0].name, '黄金配比');
});
