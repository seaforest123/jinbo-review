const { getCoverVisual } = require('../../data/candidate-visuals');

function navigateTo(url) {
  wx.navigateTo({ url });
}

Page({
  data: {
    coverVisual: getCoverVisual(),
    navRightPadding: 18,
  },

  onLoad() {
    if (!wx.getMenuButtonBoundingClientRect) return;
    try {
      const capsule = wx.getMenuButtonBoundingClientRect();
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ navRightPadding: Math.max(18, windowInfo.windowWidth - capsule.left + 12) });
    } catch (error) { /* Keep the default safe spacing. */ }
  },

  onVisualError(event) {
    this.setData({ 'coverVisual.failed': true });
  },

  startExperience() {
    navigateTo('/pages/experience/index?routeId=foil_making_candidate');
  },

  openArchive() {
    navigateTo('/pages/archive/index');
  },

  openActivity() {
    navigateTo('/pages/activity/index');
  },

  openMedia() {
    navigateTo('/pages/media/index');
  },

});
