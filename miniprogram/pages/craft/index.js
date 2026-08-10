const { CRAFT_SOURCE, listCraftSteps } = require('../../data/craft-steps');

function formatOrder(order) {
  return String(order).padStart(2, '0');
}

Page({
  data: {
    sourceNote: CRAFT_SOURCE,
    steps: listCraftSteps().map((step) => ({ ...step, orderLabel: formatOrder(step.order) })),
  },

  startFoilApplication() {
    wx.navigateTo({ url: '/pages/foil-apply/index' });
  },

  goHome() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return { title: '一片金箔，要经过十二道工序', path: '/pages/craft/index' };
  },
});

module.exports = { formatOrder };
