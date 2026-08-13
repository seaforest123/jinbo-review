const routes = require('../../data/routes');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { getNavTopPadding } = require('../../services/navigation-layout');

function createRepository() {
  return createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: () => Date.now().toString(16) });
}

Page({
  data: { reports: [], favorites: [], navTopPadding: 68 },
  onLoad() {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
  },
  async onShow() {
    try {
      const repository = createRepository();
      const [reports, favorites] = await Promise.all([repository.listSessionReports(), repository.listFavorites()]);
      this.setData({ reports, favorites: routes.filter((route) => favorites.includes(route.id)) });
    } catch (error) { this.setData({ reports: [], favorites: [] }); }
  },
  startExperience(event) { wx.navigateTo({ url: `/pages/experience/index?routeId=${event.currentTarget.dataset.routeId}` }); },
  openReport(event) {
    const { reportId, routeId } = event.currentTarget.dataset;
    if (typeof reportId !== 'string' || typeof routeId !== 'string') return;
    wx.navigateTo({ url: `/pages/result/index?routeId=${encodeURIComponent(routeId)}&reportId=${encodeURIComponent(reportId)}` });
  },
  goHome() { wx.navigateBack({ delta: 1 }); },
});
