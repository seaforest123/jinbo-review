'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { listKnowledgeCards, getKnowledgeCard } = require('../../miniprogram/data/knowledge-cards');

const notice = '候选内测内容，尚待专业确认';

test('provides exactly three candidate knowledge cards for every configured route step', () => {
  for (const route of routes) {
    const cards = listKnowledgeCards(route.id);
    assert.equal(cards.length, 3);
    assert.deepEqual(cards.map((card) => card.stepId), route.steps.map((step) => step.id));
    for (const card of cards) {
      assert.equal(card.routeId, route.id);
      assert.equal(card.notice, notice);
      assert.ok(card.title.length > 0 && card.description.length > 0 && card.observationTip.length > 0);
    }
  }
});

test('returns only safe candidate cards for configured route and step IDs', () => {
  const card = getKnowledgeCard(routes[0].id, 'motion');
  assert.equal(card.stepId, 'motion');
  assert.equal(getKnowledgeCard(routes[0].id, 'unknown'), null);
  assert.deepEqual(listKnowledgeCards('unknown'), []);
  const source = JSON.stringify(routes.flatMap((route) => listKnowledgeCards(route.id)));
  assert.doesNotMatch(source, /openid|unionid|历史|年代|产地|人物|认证/i);
});
