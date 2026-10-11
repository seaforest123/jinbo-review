'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const routes = require('../../miniprogram/data/routes');
const { listKnowledgeCards, getKnowledgeCard } = require('../../miniprogram/data/knowledge-cards');

const notice = '资料依据：中国非物质文化遗产网 · 南京金箔锻制技艺';

test('provides five sourced craft knowledge cards for every configured route step', () => {
  for (const route of routes) {
    const cards = listKnowledgeCards(route.id);
    assert.equal(cards.length, 5);
    assert.deepEqual(cards.map((card) => card.stepId), route.steps.map((step) => step.id));
    for (const card of cards) {
      assert.equal(card.routeId, route.id);
      assert.equal(card.notice, notice);
      assert.ok(card.title.length > 0 && card.description.length > 0 && card.observationTip.length > 0);
    }
  }
});

test('returns only safe sourced cards for configured route and step IDs', () => {
  const card = getKnowledgeCard(routes[0].id, 'hammer');
  assert.equal(card.stepId, 'hammer');
  assert.equal(getKnowledgeCard(routes[0].id, 'unknown'), null);
  assert.deepEqual(listKnowledgeCards('unknown'), []);
  const source = JSON.stringify(routes.flatMap((route) => listKnowledgeCards(route.id)));
  assert.match(source, /乌金纸/);
  assert.match(source, /打箔/);
  assert.match(source, /切箔/);
  assert.doesNotMatch(source, /openid|unionid|候选|尚待专业确认/i);
});
