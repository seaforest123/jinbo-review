const routes = require('../../data/routes');
const { createExperienceController } = require('../../domain/experience-controller');
const { createTrialAnalytics } = require('../../services/trial-analytics');

function readCapabilities() {
  return { continuousDrag: true, xrFrame: false, networkType: 'unknown' };
}

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
    routeId: '',
    phase: 'idle',
    routeName: '',
    step: null,
    adapter: null,
    hintCount: 0,
    retryCount: 0,
    dragProgress: 0,
    loadState: 'loading',
    isFallback: false,
  },

  onLoad(options = {}) {
    const routeId = options.routeId;
    if (!routes.some((route) => route.id === routeId)) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    const capabilities = readCapabilities();
    this.analytics = createTrialAnalytics({
      storage: createStorage(),
      cloudCall: wx.cloud.callFunction.bind(wx.cloud),
      idFactory: createIdFactory(),
      clock: () => new Date(),
      routeId,
      capabilities,
    });
    this.controller = createExperienceController({
      routes,
      routeId,
      capabilities,
      now: () => Date.now(),
      track: (name, properties) => this.analytics.track(name, properties),
    });
    this.loadStartedAt = Date.now();
    this.render();
    this.slowTimer = setTimeout(() => this.updateLoadState(), 8000);
    this.fallbackTimer = setTimeout(() => this.updateLoadState(), 15000);
  },

  onUnload() {
    clearTimeout(this.slowTimer);
    clearTimeout(this.fallbackTimer);
  },

  render() {
    const view = this.controller.getView();
    this.setData({
      routeId: view.route.id,
      routeName: view.route.displayName,
      phase: view.phase,
      step: view.step,
      adapter: view.adapter,
      hintCount: view.hintCount,
      retryCount: view.retryCount,
      dragProgress: view.dragProgress,
      loadState: view.loadState,
      isFallback: view.isFallback,
    });
  },

  updateLoadState(failed = false) {
    if (!this.controller) return;
    this.controller.updateLoad(Date.now() - this.loadStartedAt, failed);
    this.render();
  },

  startExperience() {
    this.controller.start();
    this.render();
  },

  endIntro() {
    this.controller.endIntro();
    this.render();
  },

  showHint() {
    this.controller.hint();
    this.render();
  },

  retryStep() {
    this.controller.retry();
    this.render();
  },

  completeCurrentStep() {
    this.controller.completeStep();
    this.afterStepChange();
  },

  onTouchStart(event) {
    const point = event.touches && event.touches[0];
    if (point) this.dragStart = { x: point.clientX, y: point.clientY };
  },

  onTouchMove(event) {
    const point = event.touches && event.touches[0];
    if (!this.dragStart || !point) return;
    this.controller.completeDrag({ start: this.dragStart, current: { x: point.clientX, y: point.clientY } });
    this.afterStepChange();
  },

  afterStepChange() {
    const view = this.controller.getView();
    if (view.phase === 'completed') {
      wx.redirectTo({ url: `/pages/result/index?routeId=${view.route.id}` });
      return;
    }
    this.render();
  },

  exitExperience() {
    this.controller.exit();
    wx.navigateBack({ delta: 1 });
  },
});
