const { getCoverVisual } = require('../../data/candidate-visuals');
const { getNavTopPadding } = require('../../services/navigation-layout');
const routes = require('../../data/routes');

const ROUTE_DISPLAY_NAMES = {
  foil_making_candidate: '金箔锻制体验',
};
const ROUTE_SUMMARIES = {
  foil_making_candidate: '从做捻子开始，约 3 分钟 · 新手引导可随时开启',
};

function navigateTo(url) {
  wx.navigateTo({ url });
}

Page({
  data: {
    coverVisual: getCoverVisual(),
    routeEntries: routes.map((route) => ({
      id: route.id,
      displayName: ROUTE_DISPLAY_NAMES[route.id] || route.displayName,
      summary: ROUTE_SUMMARIES[route.id] || route.banner,
      statusLabel: route.status === 'internal_placeholder' ? '候选内容' : '',
    })),
    navTopPadding: 68,
  },

  onLoad() {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  onVisualError(event) {
    this.setData({ 'coverVisual.failed': true });
  },

  startExperience(event) {
    navigateTo(`/pages/experience/index?routeId=${event.currentTarget.dataset.routeId}`);
  },

  openProgress() {
    navigateTo('/pages/progress/index');
  },

});
