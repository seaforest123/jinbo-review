const runtimeConfig = require('./config/runtime-config');

App({
  globalData: { runtimeConfig, anonymousId: null },
  onLaunch() {
    if (typeof wx === 'undefined' || !wx.cloud) throw new Error('当前微信基础库不支持云开发');
    const options = { traceUser: true };
    if (runtimeConfig.cloudEnvId) options.env = runtimeConfig.cloudEnvId;
    wx.cloud.init(options);
  },
});
