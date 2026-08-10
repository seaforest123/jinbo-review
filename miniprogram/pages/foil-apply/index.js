const { applyStroke, createFoilApplication, resetFoilApplication } = require('../../domain/foil-application');

function getPoint(event) {
  const touch = event && event.changedTouches && event.changedTouches[0];
  if (!touch || typeof touch.clientX !== 'number' || typeof touch.clientY !== 'number') return null;
  return { x: touch.clientX, y: touch.clientY };
}

function getEventTime(event) {
  return event && typeof event.timeStamp === 'number' && Number.isFinite(event.timeStamp)
    ? event.timeStamp
    : Date.now();
}

Page({
  data: {
    session: createFoilApplication(),
    foilPosition: { x: 12, y: 24 },
    message: '沿着器物轮廓缓慢拖动。快了，金箔会起皱或碎裂。',
    startedAt: 0,
  },

  onLoad() {
    this.startedAt = Date.now();
  },

  onFoilStart(event) {
    const point = getPoint(event);
    if (!point || this.data.session.complete) return;
    this.strokeStart = { ...point, at: getEventTime(event) };
  },

  onFoilMove(event) {
    const point = getPoint(event);
    if (!point || !this.strokeStart || this.data.session.complete) return;
    const x = Math.max(5, Math.min(84, Math.round((point.x / 375) * 100)));
    const y = Math.max(10, Math.min(72, Math.round((point.y / 667) * 100)));
    this.setData({ foilPosition: { x, y } });
  },

  onFoilEnd(event) {
    const point = getPoint(event);
    if (!point || !this.strokeStart || this.data.session.complete) return;
    const distancePx = Math.hypot(point.x - this.strokeStart.x, point.y - this.strokeStart.y);
    const durationMs = Math.max(1, getEventTime(event) - this.strokeStart.at);
    const session = applyStroke(this.data.session, { distancePx, durationMs });
    this.strokeStart = null;
    const message = session.lastEvent === 'broken'
      ? '动作太快，金箔已经起皱碎裂。换一张，再慢一点。'
      : session.complete
        ? '轮廓已经贴满。你亲手完成了一件贴箔成品。'
        : `贴合 ${session.coverage}% · 保持缓慢、连续的手势。`;
    this.setData({ session, message });
  },

  restartApplication() {
    this.setData({ session: resetFoilApplication(this.data.session), foilPosition: { x: 12, y: 24 }, message: '重新开始。缓慢拖动，让金箔贴住轮廓。' });
  },

  openResult() {
    if (!this.data.session.complete) return;
    const seconds = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    const { sheetsUsed, failures } = this.data.session;
    wx.navigateTo({ url: `/pages/foil-result/index?sheets=${sheetsUsed}&seconds=${seconds}&failures=${failures}` });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});

module.exports = { getPoint, getEventTime };
