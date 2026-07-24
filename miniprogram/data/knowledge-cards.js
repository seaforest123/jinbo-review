'use strict';

const NOTICE = '候选内测内容，尚待专业确认';
const routeIds = ['foil_making_candidate', 'foil_application_candidate'];
const cardTemplate = Object.freeze([
  Object.freeze({ stepId: 'observe', title: '材料与目标', description: '这是候选观察练习，请先辨认数字场景中的材料线索与本步目标。', observationTip: '留意对象的形状、层次与本步的操作边界。' }),
  Object.freeze({ stepId: 'motion', title: '动作观察', description: '这是候选动作模拟，请在数字交互中观察方向、节奏与反馈。', observationTip: '先小幅尝试，再根据反馈调整动作。' }),
  Object.freeze({ stepId: 'inspect', title: '结果检查', description: '这是候选检查练习，请回看数字结果并决定是否再次练习。', observationTip: '比较每个观察线索，记录自己仍想复习的节点。' }),
]);

const cards = Object.freeze(routeIds.flatMap((routeId) => cardTemplate.map((card) => Object.freeze({
  id: `${routeId}_${card.stepId}`,
  routeId,
  ...card,
  notice: NOTICE,
}))));

function copyCard(card) {
  return card ? { ...card } : null;
}

function listKnowledgeCards(routeId) {
  if (!routeIds.includes(routeId)) return [];
  return cards.filter((card) => card.routeId === routeId).map(copyCard);
}

function getKnowledgeCard(routeId, stepId) {
  if (!routeIds.includes(routeId) || typeof stepId !== 'string') return null;
  return copyCard(cards.find((card) => card.routeId === routeId && card.stepId === stepId));
}

module.exports = { NOTICE, listKnowledgeCards, getKnowledgeCard };
