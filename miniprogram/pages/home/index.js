const routes = require('../../data/routes');
const { getCoverVisual, getRouteVisual } = require('../../data/candidate-visuals');

function navigateTo(url) {
  wx.navigateTo({ url });
}

Page({
  data: {
    selectedRouteId: routes[0].id,
    coverVisual: getCoverVisual(),
    routes: routes.map((route) => ({ ...route, visual: getRouteVisual(route.id), visualFailed: false })),
  },

  onVisualError(event) {
    const routeId = event.currentTarget.dataset.routeId;
    if (!routeId) {
      this.setData({ 'coverVisual.failed': true });
      return;
    }
    const nextRoutes = this.data.routes.map((route) => route.id === routeId ? { ...route, visualFailed: true } : route);
    this.setData({ routes: nextRoutes });
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
