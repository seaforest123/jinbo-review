const routes = require('../../data/routes');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { listKnowledgeCards } = require('../../data/knowledge-cards');
const { getRouteVisual, getStepVisual } = require('../../data/candidate-visuals');
const { getNavTopPadding } = require('../../services/navigation-layout');
const publicRoutes = routes.filter((route) => route.id === 'foil_making_candidate');

function createRepository() {
  return createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: () => Date.now().toString(16) });
}

Page({
  data: { routes: [], navTopPadding: 68 },

  onLoad() {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
  },

  async onShow() {
    try {
      const repository = createRepository();
      const favorites = await repository.listFavorites();
      const summaries = await Promise.all(publicRoutes.map(async (route) => ({
        ...route,
        displayName: '金箔锻制体验（候选内容）',
        visual: getRouteVisual(route.id),
        cards: listKnowledgeCards(route.id).map((card) => ({ ...card, visual: getStepVisual(card.stepId) })),
        favorite: favorites.includes(route.id),
        progress: await repository.getRouteProgress(route.id),
      })));
      this.setData({ routes: summaries });
    } catch (error) {
      this.setData({
        routes: publicRoutes.map((route) => ({
          ...route,
          displayName: '金箔锻制体验（候选内容）',
          visual: getRouteVisual(route.id),
          cards: listKnowledgeCards(route.id).map((card) => ({ ...card, visual: getStepVisual(card.stepId) })),
          favorite: false,
          progress: { completedCount: 0 },
        })),
      });
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
