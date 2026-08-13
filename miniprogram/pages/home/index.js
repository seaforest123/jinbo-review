const { getCoverVisual } = require('../../data/candidate-visuals');
const { getNavRightPadding, getNavTopPadding } = require('../../services/navigation-layout');

function navigateTo(url) {
  wx.navigateTo({ url });
}

Page({
  data: {
    coverVisual: getCoverVisual(),
    navRightPadding: 18,
    navTopPadding: 68,
  },

  onLoad() {
    this.setData({ navRightPadding: getNavRightPadding(wx), navTopPadding: getNavTopPadding(wx) });
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
