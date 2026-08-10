function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

Page({
  data: { sheets: 1, seconds: 0, failures: 0 },

  onLoad(options = {}) {
    this.setData({ sheets: readPositiveInteger(options.sheets, 1), seconds: readPositiveInteger(options.seconds, 1), failures: Math.max(0, readPositiveInteger(options.failures, 0) || 0) });
  },

  tryAgain() {
    wx.navigateBack({ delta: 1 });
  },

  backToCraft() {
    wx.navigateBack({ delta: 2 });
  },

  onShareAppMessage() {
    return { title: '我完成了一次贴箔体验', path: '/pages/craft/index' };
  },
});

module.exports = { readPositiveInteger };
