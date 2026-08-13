const routes = require('../../data/routes');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { getNavTopPadding } = require('../../services/navigation-layout');

Page({
  data: { completedRouteCount: 0, navTopPadding: 68 },
  onLoad() {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
  },
  async onShow() {
    try {
      const repository = createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: () => Date.now().toString(16) });
      const progress = await Promise.all(routes.map((route) => repository.getRouteProgress(route.id)));
      this.setData({ completedRouteCount: progress.filter((item) => item.completedCount > 0).length });
    } catch (error) { this.setData({ completedRouteCount: 0 }); }
  },
  goHome() {
    wx.navigateBack({ delta: 1 });
  },
});
