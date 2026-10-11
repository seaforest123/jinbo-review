'use strict';

const CRAFT_SOURCE = '流程依据：赵绪成《南京金箔个案研究》；题名、年份及页码待补。';

const CRAFT_STEPS = Object.freeze([
  Object.freeze({ id: 'alloy', order: 1, phase: '成金', name: '黄金配比', oneLiner: '按客户需求给黄金配入银、铜等元素。', detail: '常见配比为 98% 金与 2% 铜；纯金过软，不易定型。' }),
  Object.freeze({ id: 'cast-bar', order: 2, phase: '成金', name: '化金条', oneLiner: '把原料熔化后倒入铁槽，冷却成金条。', detail: '黄金原料在坩埚中高温熔化，再倒入铁槽定形。' }),
  Object.freeze({ id: 'beat-leaf', order: 3, phase: '初展', name: '拍叶', alias: '压延', oneLiner: '把金条捶打或压延成薄如纸的金叶子。', detail: '它让金条第一次从块状变成可裁切的薄叶。' }),
  Object.freeze({ id: 'make-twists', order: 4, phase: '初展', name: '做捻子', oneLiner: '把金叶切成一厘米见方的小片。', detail: '这些小片被称作金捻子，是后续夹金的单位。' }),
  Object.freeze({ id: 'open-packet', order: 5, phase: '初展', name: '落金开子', oneLiner: '裁剪并炕热乌金纸，制成夹金用的金开子。', detail: '乌金纸包在此阶段被准备好，承接之后的夹金与锤打。' }),
  Object.freeze({ id: 'attach-twists', order: 6, phase: '初展', name: '沾金捻子', oneLiner: '逐张把金捻子夹入乌金纸中，叠好包裹。', detail: '女工把两千余层纸与金捻子逐张叠好。' }),
  Object.freeze({ id: 'beat-packet', order: 7, phase: '锻细', name: '打金开子', oneLiner: '锤打乌金纸包，让金捻子初步延展。', detail: '金片在纸包的保护中开始被打薄。' }),
  Object.freeze({ id: 'repack', order: 8, phase: '锻细', name: '装开子', oneLiner: '用鹅毛挑出打薄金片，转入更大的家生。', detail: '家生是重新装叠后的更大乌金纸包。' }),
  Object.freeze({ id: 'warm-packet', order: 9, phase: '锻细', name: '炕炕', oneLiner: '加热家生，蒸发水分并稳定温湿度。', detail: '这一步为下一次高强度锤打准备稳定的纸包状态。' }),
  Object.freeze({ id: 'beat-fine', order: 10, phase: '锻细', name: '打了细', oneLiner: '正副手对坐捶打约三万锤，把金片打到极薄。', detail: '这是技术难度最高的核心工序，也是金箔薄、柔、轻的关键。', highlight: '约三万锤' }),
  Object.freeze({ id: 'extract-foil', order: 11, phase: '出箔', name: '出具', alias: '出起', oneLiner: '用口风与鹅毛，把极薄金箔从家生中取出。', detail: '金箔约为 0.1 微米；取箔后进入封装与裁切环节。' }),
  Object.freeze({ id: 'cut-foil', order: 12, phase: '出箔', name: '切金箔', oneLiner: '在竹板上用竹刀把金箔切成标准规格。', detail: '口诀为“切箔要穷匡子、富角刀、点三角、合龙门、细线边”。' }),
]);

function listCraftSteps() {
  return CRAFT_STEPS.map((step) => ({ ...step }));
}

module.exports = { CRAFT_SOURCE, listCraftSteps };
