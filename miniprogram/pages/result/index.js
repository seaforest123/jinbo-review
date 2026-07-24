const routes = require('../../data/routes');
const { createTrialAnalytics } = require('../../services/trial-analytics');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { listKnowledgeCards } = require('../../data/knowledge-cards');

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
    report: null,
    knowledgeCards: [],
    completedStepIds: [],
  },

  async onLoad(options = {}) {
    const routeId = routes.some((route) => route.id === options.routeId)
      ? options.routeId
      : routes[0].id;
    this.setData({ routeId, knowledgeCards: listKnowledgeCards(routeId) });
    if (typeof options.reportId === 'string') {
      try {
        const repository = createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: createIdFactory() });
        const report = await repository.getSessionReport(options.reportId) || null;
        const completedStepIds = report ? report.steps.filter((step) => step.status === 'completed').map((step) => step.stepId) : [];
        this.setData({ report, completedStepIds, knowledgeCards: listKnowledgeCards(routeId).map((card) => ({ ...card, completed: completedStepIds.includes(card.stepId) })) });
      } catch (error) { this.setData({ report: null, completedStepIds: [] }); }
    }
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

  openProgress() {
    this.trackAction('archive');
    wx.navigateTo({ url: '/pages/progress/index' });
  },

  goHome() {
    this.trackAction('home');
    wx.navigateTo({ url: '/pages/home/index' });
  },
});
