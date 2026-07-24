const routes = require('../../data/routes');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { listKnowledgeCards } = require('../../data/knowledge-cards');

function createRepository() {
  return createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: () => Date.now().toString(16) });
}

Page({
  data: { routes: [] },

  async onShow() {
    try {
      const repository = createRepository();
      const favorites = await repository.listFavorites();
      const summaries = await Promise.all(routes.map(async (route) => ({ ...route, cards: listKnowledgeCards(route.id), favorite: favorites.includes(route.id), progress: await repository.getRouteProgress(route.id) })));
      this.setData({ routes: summaries });
    } catch (error) {
      this.setData({ routes: routes.map((route) => ({ ...route, cards: listKnowledgeCards(route.id), favorite: false, progress: { completedCount: 0 } })) });
    }
  },

  startExperience(event) { wx.navigateTo({ url: `/pages/experience/index?routeId=${event.currentTarget.dataset.routeId}` }); },
  async toggleFavorite(event) {
    try { await createRepository().toggleFavorite(event.currentTarget.dataset.routeId); } catch (error) { /* Empty state remains safe. */ }
    this.onShow();
  },
  openProgress() { wx.navigateTo({ url: '/pages/progress/index' }); },
  goHome() {
    wx.navigateBack({ delta: 1 });
  },
});
