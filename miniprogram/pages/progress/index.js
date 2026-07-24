const routes = require('../../data/routes');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');

function createRepository() {
  return createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: () => Date.now().toString(16) });
}

Page({
  data: { reports: [], favorites: [] },
  async onShow() {
    try {
      const repository = createRepository();
      const [reports, favorites] = await Promise.all([repository.listSessionReports(), repository.listFavorites()]);
      this.setData({ reports, favorites: routes.filter((route) => favorites.includes(route.id)) });
    } catch (error) { this.setData({ reports: [], favorites: [] }); }
  },
  startExperience(event) { wx.navigateTo({ url: `/pages/experience/index?routeId=${event.currentTarget.dataset.routeId}` }); },
  goHome() { wx.navigateBack({ delta: 1 }); },
});
