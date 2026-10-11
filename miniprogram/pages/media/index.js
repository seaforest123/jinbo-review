const { listVideoSections } = require('../../data/video-library');
const { getNavTopPadding } = require('../../services/navigation-layout');

const CATEGORY_PAGES = Object.freeze({
  'artisan-interviews': '/pages/media/interviews/index',
  'craft-explanations': '/pages/media/process/index',
  'extended-archive': '/pages/media/extended/index',
});

Page({
  data: {
    categories: [],
    navTopPadding: 68,
  },

  onLoad() {
    this.setData({ navTopPadding: getNavTopPadding(wx) });
    const categories = listVideoSections().map((section, index) => ({
      ...section,
      order: String(index + 1).padStart(2, '0'),
      pagePath: CATEGORY_PAGES[section.id],
      countLabel: section.videos.length ? `${section.videos.length} 条影像` : '内容待接入',
    }));
    this.setData({ categories });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  openCategory(event) {
    const url = event.currentTarget.dataset.pagePath;
    if (url) wx.navigateTo({ url });
  },
});
