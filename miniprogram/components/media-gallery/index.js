const { listVideoSections, getVideoPlayback } = require('../../data/video-library');
const { createCloudVideoSource } = require('../../services/cloud-video-source');
const { getNavTopPadding } = require('../../services/navigation-layout');

function withPlaybackState(section) {
  return {
    ...section,
    videos: section.videos.map((video) => {
      const playback = getVideoPlayback(video.id);
      return {
        ...video,
        playable: Boolean(playback && (playback.src || playback.sourceType === 'cloud')),
      };
    }),
  };
}

Component({
  properties: {
    sectionId: { type: String, value: '' },
  },

  data: {
    section: { id: '', title: '', eyebrow: '', description: '', emptyCopy: '', videos: [] },
    activeVideoId: '',
    activeVideoSource: '',
    activeVideoPoster: '',
    loadingVideoId: '',
    navTopPadding: 68,
  },

  lifetimes: {
    attached() {
      this.setData({ navTopPadding: getNavTopPadding(wx) });
      const section = listVideoSections().find((candidate) => candidate.id === this.data.sectionId);
      if (!section) return;
      const preparedSection = withPlaybackState(section);
      this.setData({ section: preparedSection });
      this.cloudVideoSource = this.createCloudVideoSource();
      this.resolveCloudPosters(preparedSection);
    },
  },

  methods: {
    createCloudVideoSource() {
      if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return null;
      return createCloudVideoSource({ getTempFileURL: wx.cloud.getTempFileURL.bind(wx.cloud) });
    },

    async resolveCloudPosters(section) {
      if (!this.cloudVideoSource) return;
      const posterIds = section.videos.map((video) => video.source.posterCloudFileId).filter(Boolean);
      if (!posterIds.length) return;
      try {
        const resolved = await this.cloudVideoSource.resolveFiles(posterIds);
        this.setData({
          section: {
            ...section,
            videos: section.videos.map((video) => ({
              ...video,
              source: { ...video.source, posterPath: resolved.get(video.source.posterCloudFileId) || video.source.posterPath },
            })),
          },
        });
      } catch (error) { /* A missing poster must not block the video catalogue. */ }
    },

    async playVideo(event) {
      const videoId = event.currentTarget.dataset.videoId;
      if (this.data.loadingVideoId) return;
      let playback = getVideoPlayback(videoId);
      if (playback && playback.sourceType === 'cloud') {
        if (!this.cloudVideoSource) {
          wx.showToast({ title: '当前环境未连接云端影像', icon: 'none' });
          return;
        }
        this.setData({ loadingVideoId: videoId });
        try {
          playback = await this.cloudVideoSource.resolve(playback);
        } catch (error) {
          playback = null;
        }
        this.setData({ loadingVideoId: '' });
      }
      if (!playback || !playback.src) {
        wx.showToast({ title: '视频暂不可播放，请稍后重试', icon: 'none' });
        return;
      }
      this.setData({
        activeVideoId: playback.videoId,
        activeVideoSource: playback.src,
        activeVideoPoster: playback.posterPath,
      });
    },

    closePlayer() {
      this.setData({ activeVideoId: '', activeVideoSource: '', activeVideoPoster: '' });
    },

    goBack() {
      wx.navigateBack({ delta: 1 });
    },
  },
});
