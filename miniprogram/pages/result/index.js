const routes = require('../../data/routes');
const { createTrialAnalytics } = require('../../services/trial-analytics');
const { createLearningRepository } = require('../../services/learning-repository');
const { createWxLearningStorage } = require('../../services/wx-learning-storage');
const { listKnowledgeCards } = require('../../data/knowledge-cards');
const { getStepVisual } = require('../../data/candidate-visuals');
const { createFoilVisual } = require('../../domain/foil-visual');
const { getNavTopPadding } = require('../../services/navigation-layout');

function createStorage() {
  return {
    get: (key) => new Promise((resolve) => wx.getStorage({ key, success: (result) => resolve(result.data), fail: () => resolve(undefined) })),
    set: (key, value) => new Promise((resolve) => wx.setStorage({ key, data: value, complete: resolve })),
  };
}

function createIdFactory() {
  return () => `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(-16).padStart(16, '0');
}

function summarizeReport(report) {
  const steps = report && Array.isArray(report.steps) ? report.steps : [];
  return {
    completedCount: steps.filter((step) => step.status === 'completed').length,
    hintCount: steps.reduce((sum, step) => sum + (Number.isInteger(step.hintCount) ? step.hintCount : 0), 0),
    retryCount: steps.reduce((sum, step) => sum + (Number.isInteger(step.retryCount) ? step.retryCount : 0), 0),
  };
}

Page({
  data: {
    demoMode: false,
    routeId: routes[0].id,
    report: null,
    knowledgeCards: [],
    completedStepIds: [],
    reportDuration: '约 3 分钟',
    reportStats: { completedCount: 3, hintCount: 0, retryCount: 0 },
    celebrationStars: Array.from({ length: 12 }, (_, index) => index),
    posterVisible: false,
    posterPath: '',
    posterSaving: false,
    foilResult: null,
    foilVisual: [],
    foilQualityLabel: '工艺记录未读取',
    navTopPadding: 68,
  },

  async onLoad(options = {}) {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
    const demoMode = options.mode === 'demo';
    const routeId = routes.some((route) => route.id === options.routeId)
      ? options.routeId
      : routes[0].id;
    let foilResult = null;
    try { foilResult = wx.getStorageSync(demoMode ? 'latest_foil_demo_result' : 'latest_foil_result') || null; } catch (error) { /* optional local result */ }
    const labels = { perfect: '匀净成叶', minor: '轻微瑕疵', obvious: '明显瑕疵' };
    const demoCompletedStepIds = ['hammer', 'inspect', 'finish'];
    const foilVisual = foilResult ? createFoilVisual({
      grid: foilResult.grid,
      touched: foilResult.touched || foilResult.grid.map((row) => row.map(() => true)),
      rotation: foilResult.rotation || 0,
    }) : [];
    this.setData({
      demoMode,
      routeId,
      foilResult,
      foilVisual,
      foilQualityLabel: foilResult ? labels[foilResult.metrics.quality] : '工艺记录未读取',
      reportDuration: demoMode ? '90 秒演示' : this.data.reportDuration,
      reportStats: demoMode ? { completedCount: 3, hintCount: 0, retryCount: 0 } : this.data.reportStats,
      completedStepIds: demoMode ? demoCompletedStepIds : [],
      knowledgeCards: listKnowledgeCards(routeId).map((card) => ({
        ...card,
        visual: getStepVisual(card.stepId),
        completed: demoMode && demoCompletedStepIds.includes(card.stepId),
        demoPreset: demoMode && !demoCompletedStepIds.includes(card.stepId),
      })),
    });
    if (!demoMode && typeof options.reportId === 'string') {
      try {
        const repository = createLearningRepository({ routes, storage: createWxLearningStorage(wx), now: () => Date.now(), idFactory: createIdFactory() });
        const report = await repository.getSessionReport(options.reportId) || null;
        const completedStepIds = report ? report.steps.filter((step) => step.status === 'completed').map((step) => step.stepId) : [];
        const reportDuration = report
          ? `${Math.max(1, Math.round(report.elapsedMs / 60000))} 分钟`
          : '约 3 分钟';
        this.setData({
          report,
          reportDuration,
          reportStats: summarizeReport(report),
          completedStepIds,
          knowledgeCards: listKnowledgeCards(routeId).map((card) => ({ ...card, visual: getStepVisual(card.stepId), completed: completedStepIds.includes(card.stepId) })),
        });
      } catch (error) { this.setData({ report: null, completedStepIds: [] }); }
    }
    this.analytics = null;
    if (!demoMode) {
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
    }
  },

  trackAction(action) {
    if (this.analytics) this.analytics.track('result_action', { action });
  },

  generateSharePoster() {
    this.trackAction('share');
    this.setData({ posterVisible: true, posterPath: '' }, () => this.drawSharePoster());
  },

  drawSharePoster() {
    if (typeof wx.createCanvasContext !== 'function') {
      wx.showToast({ title: '当前设备暂不支持海报', icon: 'none' });
      return;
    }
    const context = wx.createCanvasContext('share-poster', this);
    const stats = this.data.reportStats;
    const duration = this.data.reportDuration;
    const width = 600;
    const height = 900;

    context.setFillStyle('#17100c');
    context.fillRect(0, 0, width, height);
    const glow = context.createLinearGradient(0, 0, width, height);
    glow.addColorStop(0, '#4b2c13');
    glow.addColorStop(.55, '#1f140d');
    glow.addColorStop(1, '#100b08');
    context.setFillStyle(glow);
    context.fillRect(0, 0, width, height);

    context.setStrokeStyle('rgba(244,215,123,.55)');
    context.setLineWidth(2);
    context.strokeRect(28, 28, width - 56, height - 56);
    context.setFillStyle('#f4d77b');
    context.setFontSize(22);
    context.fillText('JIN · BO  金箔非遗数字展厅', 58, 82);
    context.setFillStyle('#fff8e8');
    context.setFontSize(48);
    context.fillText('我完成了一次', 58, 170);
    context.fillText('金箔锻制体验', 58, 232);
    context.setFillStyle('rgba(255,248,232,.62)');
    context.setFontSize(24);
    context.fillText('从乌金纸，到万次锤击中的一叶金光', 58, 282);

    context.setFillStyle('rgba(255,255,255,.07)');
    context.fillRect(58, 334, 484, 218);
    if (this.data.foilVisual.length) {
      const foilX = 358;
      const foilY = 360;
      const foilSize = 150;
      const patch = foilSize / 4;
      this.data.foilVisual.forEach((cell) => {
        const colors = { thick: '#f7d77c', ideal: '#d5a13b', thin: '#98622d', risk: '#6e3328' };
        context.setFillStyle(colors[cell.state] || colors.ideal);
        context.fillRect(foilX + cell.col * patch, foilY + cell.row * patch, patch + 1, patch + 1);
      });
      context.setStrokeStyle('rgba(255,238,174,.72)');
      context.setLineWidth(5);
      context.strokeRect(foilX, foilY, foilSize, foilSize);
    }
    context.setFillStyle('#f4d77b');
    context.setFontSize(52);
    context.fillText(`${stats.completedCount}/${this.data.demoMode ? 3 : 5}`, 92, 420);
    context.setFillStyle('rgba(255,248,232,.58)');
    context.setFontSize(21);
    context.fillText('完成学习节点', 92, 462);
    context.fillText(this.data.foilQualityLabel, 368, 536);
    context.setFillStyle('#fff8e8');
    context.setFontSize(23);
    context.fillText(`${duration} · 提示 ${stats.hintCount} 次 · 调整 ${stats.retryCount} 次`, 92, 515);

    context.setStrokeStyle('rgba(244,215,123,.38)');
    context.beginPath();
    context.moveTo(58, 620);
    context.lineTo(542, 620);
    context.stroke();
    context.setFillStyle('#f4d77b');
    context.setFontSize(26);
    context.fillText(`本次成叶：${this.data.foilQualityLabel}`, 58, 674);
    context.setFillStyle('#fff8e8');
    context.setFontSize(30);
    context.fillText('一叶金箔，藏着千次锤炼', 58, 738);
    context.setFillStyle('rgba(255,248,232,.5)');
    context.setFontSize(20);
    context.fillText('金箔锻制技艺', 58, 800);
    context.fillText('首批国家级非物质文化遗产代表性项目', 58, 834);
    context.setStrokeStyle('#a94f39');
    context.setLineWidth(3);
    context.strokeRect(462, 770, 70, 70);
    context.setFillStyle('#c56b52');
    context.setFontSize(20);
    context.fillText('金陵', 477, 800);
    context.fillText('金箔', 477, 826);

    context.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'share-poster',
        width,
        height,
        destWidth: 1200,
        destHeight: 1800,
        fileType: 'png',
        quality: 1,
        success: ({ tempFilePath }) => this.setData({ posterPath: tempFilePath }),
        fail: () => wx.showToast({ title: '海报生成失败，请重试', icon: 'none' }),
      }, this);
    });
  },

  closeSharePoster() {
    this.setData({ posterVisible: false });
  },

  noop() {},

  saveSharePoster() {
    if (!this.data.posterPath || this.data.posterSaving) return;
    this.setData({ posterSaving: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: '海报已保存', icon: 'success' }),
      fail: () => wx.showToast({ title: '未能保存，请检查相册权限', icon: 'none' }),
      complete: () => this.setData({ posterSaving: false }),
    });
  },

  onShareAppMessage() {
    this.trackAction('share');
    return {
      title: '我完成了一次金箔锻制数字体验',
      path: '/pages/home/index',
    };
  },

  restartExperience() {
    this.trackAction('retry');
    wx.navigateTo({ url: `/pages/experience/index?routeId=${this.data.routeId}${this.data.demoMode ? '&mode=demo' : ''}` });
  },

  openArchive() {
    this.trackAction('archive');
    wx.switchTab({ url: '/pages/archive/index' });
  },

  openActivity() {
    this.trackAction('activity');
    wx.switchTab({ url: '/pages/activity/index' });
  },

  openProgress() {
    if (this.data.demoMode) {
      wx.showToast({ title: '完整体验后可查看', icon: 'none' });
      return;
    }
    this.trackAction('archive');
    wx.navigateTo({ url: '/pages/progress/index' });
  },

  goHome() {
    this.trackAction('home');
    wx.switchTab({ url: '/pages/home/index' });
  },
});

module.exports = { summarizeReport };
