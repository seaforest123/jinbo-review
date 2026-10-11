const DEFAULT_NAV_RIGHT_PADDING = 18;
const MAX_NAV_RIGHT_PADDING = 120;
const NAV_RIGHT_GAP = 12;

function getNavRightPadding(wxApi) {
  if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') return DEFAULT_NAV_RIGHT_PADDING;
  try {
    const capsule = wxApi.getMenuButtonBoundingClientRect();
    const windowInfo = typeof wxApi.getWindowInfo === 'function' ? wxApi.getWindowInfo() : wxApi.getSystemInfoSync();
    const windowWidth = Number(windowInfo && windowInfo.windowWidth);
    const capsuleLeft = Number(capsule && capsule.left);
    if (!Number.isFinite(windowWidth) || !Number.isFinite(capsuleLeft)) return DEFAULT_NAV_RIGHT_PADDING;
    return Math.min(MAX_NAV_RIGHT_PADDING, Math.max(DEFAULT_NAV_RIGHT_PADDING, windowWidth - capsuleLeft + NAV_RIGHT_GAP));
  } catch (error) {
    return DEFAULT_NAV_RIGHT_PADDING;
  }
}

// Custom-navigation pages must start below the floating capsule button. env(safe-area-inset-top)
// is not enough on its own: it reports 0 on notchless devices and the simulator, and even 44px on
// a notched iPhone still lands above the capsule's bottom edge, so page content collides with it.
const DEFAULT_NAV_TOP_PADDING = 68;
const MAX_NAV_TOP_PADDING = 160;
const NAV_TOP_GAP = 20;

function getNavTopPadding(wxApi) {
  if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') return DEFAULT_NAV_TOP_PADDING;
  try {
    const capsule = wxApi.getMenuButtonBoundingClientRect();
    const capsuleTop = Number(capsule && capsule.top);
    const capsuleHeight = Number(capsule && capsule.height);
    if (!Number.isFinite(capsuleTop) || !Number.isFinite(capsuleHeight)) return DEFAULT_NAV_TOP_PADDING;
    return Math.min(MAX_NAV_TOP_PADDING, Math.max(DEFAULT_NAV_TOP_PADDING, capsuleTop + capsuleHeight + NAV_TOP_GAP));
  } catch (error) {
    return DEFAULT_NAV_TOP_PADDING;
  }
}

module.exports = { getNavRightPadding, getNavTopPadding };
