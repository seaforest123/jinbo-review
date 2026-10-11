'use strict';

const NOTICE = '资料依据：中国非物质文化遗产网 · 南京金箔锻制技艺';
const routeIds = ['foil_making_candidate'];
const cardTemplate = Object.freeze([
  Object.freeze({
    stepId: 'twist', title: '做捻子：先把金分成小片',
    description: '金条要先裁成大小合适的小金片，尺寸会影响后续装入纸层时的对齐。',
    observationTip: '裁得过大或过小都不会自动修正，需要重新调整。',
  }),
  Object.freeze({
    stepId: 'pack', title: '装家生：层层隔开',
    description: '乌金纸把金片逐层隔开，让锤击力量传递，同时避免极薄金箔彼此粘连。',
    observationTip: '金片越靠近夹层中央，后续越容易锤得均匀。',
  }),
  Object.freeze({
    stepId: 'hammer', title: '打箔：节奏之外还有落点',
    description: '稳定节拍配合不断变化的落点，使金片均匀延展；反复重锤同一区域会增加破损风险。',
    observationTip: '旋转箔包不是装饰动作，它会暴露原先难以触及的盲区。',
  }),
  Object.freeze({
    stepId: 'inspect', title: '出具：用光检查厚薄',
    description: '展开纸层后，反光、透光与边缘状态会暴露厚薄不均。',
    observationTip: '发现厚区可返回补锤；直接确认会把瑕疵带到成品。',
  }),
  Object.freeze({
    stepId: 'finish', title: '切箔成叶：前序结果在此显现',
    description: '鹅毛辅助展平，再沿线切成标准方叶。前序厚薄和破损会保留在最终箔叶上。',
    observationTip: '成品并不总是完美，它记录了整条制作过程。',
  }),
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
