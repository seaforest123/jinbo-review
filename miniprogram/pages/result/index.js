const routes = require('../../data/routes');
const { createTrialAnalytics } = require('../../services/trial-analytics');

function createStorage() {
  return {
    get: (key) => new Promise((resolve) => wx.getStorage({ key, success: (result) => resolve(result.data), fail: () => resolve(undefined) })),
    set: (key, value) => new Promise((resolve) => wx.setStorage({ key, data: value, complete: resolve })),
  };
}

function createIdFactory() {
  return () => `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(-16).padStart(16, '0');
}

Page({
  data: {
    routeId: routes[0].id,
  },

  onLoad(options = {}) {
    const routeId = routes.some((route) => route.id === options.routeId)
      ? options.routeId
      : routes[0].id;
    this.setData({ routeId });
    try {
      this.analytics = createTrialAnalytics({
        storage: createStorage(),
        cloudCall: wx.cloud.callFunction.bind(wx.cloud),
        idFactory: createIdFactory(),
        clock: () => new Date(),
        routeId,
        capabilities: { xrFrame: false, continuousDrag: true, networkType: 'unknown' },
      });
    } catch (error) {
      this.analytics = null;
    }
  },

  trackAction(action) {
    if (this.analytics) this.analytics.track('result_action', { action });
  },

  restartExperience() {
    this.trackAction('retry');
    wx.navigateTo({ url: `/pages/experience/index?routeId=${this.data.routeId}` });
  },

  openArchive() {
    this.trackAction('archive');
    wx.navigateTo({ url: '/pages/archive/index' });
  },

  openActivity() {
    this.trackAction('activity');
    wx.navigateTo({ url: '/pages/activity/index' });
  },

  goHome() {
    this.trackAction('home');
    wx.navigateTo({ url: '/pages/home/index' });
  },
});
