const routes = require('../../data/routes');

function navigateTo(url) {
  wx.navigateTo({ url });
}

Page({
  data: {
    selectedRouteId: routes[0].id,
    routes,
  },

  onRouteSelect(event) {
    const routeId = event.currentTarget.dataset.routeId;
    if (!routes.some((route) => route.id === routeId)) return;
    if (typeof this.setData === 'function') this.setData({ selectedRouteId: routeId });
    else this.data.selectedRouteId = routeId;
  },

  startExperience() {
    navigateTo(`/pages/experience/index?routeId=${this.data.selectedRouteId}`);
  },

  openArchive() {
    navigateTo('/pages/archive/index');
  },

  openActivity() {
    navigateTo('/pages/activity/index');
  },
});
