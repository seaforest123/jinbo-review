const { listVideoSections } = require('../../data/video-library');

const CATEGORY_PAGES = Object.freeze({
  'artisan-interviews': '/pages/media/interviews/index',
  'craft-explanations': '/pages/media/process/index',
  'extended-archive': '/pages/media/extended/index',
});

Page({
  data: {
    categories: [],
    navRightPadding: 18,
  },

  onLoad() {
    const categories = listVideoSections().map((section, index) => ({
      ...section,
      order: String(index + 1).padStart(2, '0'),
      pagePath: CATEGORY_PAGES[section.id],
      countLabel: section.videos.length ? `${section.videos.length} 条影像` : '内容待接入',
    }));
    this.setData({ categories });
    if (!wx.getMenuButtonBoundingClientRect) return;
    try {
      const capsule = wx.getMenuButtonBoundingClientRect();
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ navRightPadding: Math.max(18, windowInfo.windowWidth - capsule.left + 12) });
    } catch (error) { /* Keep the default safe spacing. */ }
  },

  openCategory(event) {
    const url = event.currentTarget.dataset.pagePath;
    if (url) wx.navigateTo({ url });
  },

  goHome() {
    wx.navigateBack({ delta: 1 });
  },
});
