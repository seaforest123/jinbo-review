const runtimeConfig = require('./config/runtime-config');
const localRoutes = require('./data/routes');
const { createContentRepository } = require('./services/content-repository');

function loadRuntimeConfig() {
  if (typeof process !== 'undefined' && process.release && process.release.name === 'node') {
    return runtimeConfig;
  }
  try {
    const localConfig = require('./config/runtime-config.local');
    return Object.freeze({ ...runtimeConfig, ...localConfig });
  } catch (error) {
    return runtimeConfig;
  }
}

App({
  globalData: { runtimeConfig: loadRuntimeConfig(), anonymousId: null, contentRepository: null },
  onLaunch() {
    if (typeof wx === 'undefined' || !wx.cloud) throw new Error('当前微信基础库不支持云开发');
    const options = { traceUser: true };
    if (this.globalData.runtimeConfig.cloudEnvId) options.env = this.globalData.runtimeConfig.cloudEnvId;
    wx.cloud.init(options);
    this.globalData.contentRepository = createContentRepository({
      database: wx.cloud.database(),
      localRoutes,
    });
  },
});
