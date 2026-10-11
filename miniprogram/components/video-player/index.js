Component({
  properties: {
    src: { type: String, value: '' },
    poster: { type: String, value: '' },
    height: { type: String, value: '260rpx' },
    autoplay: { type: Boolean, value: false },
    muted: { type: Boolean, value: false },
    controls: { type: Boolean, value: true },
    showCenterPlayBtn: { type: Boolean, value: true }
  },

  methods: {
    handleEnded(event) {
      this.triggerEvent('ended', event.detail);
    },

    handleError(event) {
      this.triggerEvent('error', event.detail);
    }
  }
});
