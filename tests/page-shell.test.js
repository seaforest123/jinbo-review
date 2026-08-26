const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function read(page, extension = 'wxml') {
  return fs.readFileSync(path.join(root, 'miniprogram/pages', page, `index.${extension}`), 'utf8');
}
function load(page) {
  const target = require.resolve(path.join(root, 'miniprogram/pages', page, 'index.js'));
  const previous = global.Page;
  let definition;
  global.Page = (value) => { definition = value; };
  delete require.cache[target];
  require(target);
  if (previous === undefined) delete global.Page; else global.Page = previous;
  return definition;
}

test('home exposes the five-step route as its primary navigation', () => {
  const page = load('home');
  const markup = read('home');
  assert.equal(typeof page.startExperience, 'function');
  assert.match(markup, /五道工序/);
  assert.match(markup, /process-rail/);
  assert.match(markup, /五道工序，一次完成/);
  assert.match(markup, /实际合作对象与城市待专业访谈确认/);
  assert.equal(JSON.parse(read('home', 'json')).navigationStyle, 'custom');
  assert.match(markup, /PROCESS LAB/);
  assert.match(markup, /wx:for="\{\{routeEntries\}\}"/);
  assert.match(markup, /data-route-id="\{\{item\.id\}\}" bindtap="startExperience"/);
  assert.match(markup, /class="route-entry-status">\{\{item\.statusLabel\}\}/);
  assert.equal((markup.match(/bindtap="startExperience"/g) || []).length, 1);

  const source = read('home', 'js');
  assert.match(source, /routeEntries: routes\.map\(\(route\) => \(\{/);
  assert.match(source, /displayName: ROUTE_DISPLAY_NAMES\[route\.id\] \|\| route\.displayName/);
  assert.match(source, /statusLabel: route\.status === 'internal_placeholder' \? '候选内容' : ''/);
  assert.doesNotMatch(source, /routes\.filter\(\(route\) => route\.id === 'foil_making_candidate'\)/);
});

test('the public main flow links home to the five-step experience', () => {
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    load('home').startExperience({ currentTarget: { dataset: { routeId: 'foil_making_candidate' } } });
    assert.deepEqual(calls, ['/pages/experience/index?routeId=foil_making_candidate']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('the custom tab bar lists home, archive, media and activity in order and switches tabs', () => {
  const target = require.resolve(path.join(root, 'miniprogram/custom-tab-bar/index.js'));
  const previousComponent = global.Component;
  let definition;
  global.Component = (value) => { definition = value; };
  delete require.cache[target];
  require(target);
  if (previousComponent === undefined) delete global.Component; else global.Component = previousComponent;

  assert.deepEqual(definition.data.list.map((item) => [item.pagePath, item.text]), [
    ['/pages/home/index', '首页'],
    ['/pages/archive/index', '金箔志'],
    ['/pages/media/index', '影像记录'],
    ['/pages/activity/index', '活动'],
  ]);

  const calls = [];
  const previousWx = global.wx;
  global.wx = { switchTab: ({ url }) => calls.push(url) };
  try {
    const context = { data: { selected: 0 }, setData(patch) { Object.assign(this.data, patch); } };
    definition.methods.switchTab.call(context, { currentTarget: { dataset: { index: 2 } } });
    assert.deepEqual(calls, ['/pages/media/index']);
    assert.equal(context.data.selected, 2);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('media centre separates the three video collections into dedicated routes', () => {
  const markup = read('media');
  for (const text of ['{{item.title}}', 'category-card', 'openCategory']) {
    assert.match(markup, new RegExp(text.replace(/[<>]/g, '\\$&')));
  }
  const page = load('media');
  assert.equal(typeof page.openCategory, 'function');
  assert.equal(typeof page.goHome, 'undefined');
  assert.equal(JSON.parse(read('media', 'json')).navigationStyle, 'custom');
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    page.openCategory({ currentTarget: { dataset: { pagePath: '/pages/media/process/index' } } });
    assert.deepEqual(calls, ['/pages/media/process/index']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('each media collection page selects exactly one reusable gallery', () => {
  const categories = [
    ['media/interviews', 'artisan-interviews'],
    ['media/process', 'craft-explanations'],
    ['media/extended', 'extended-archive'],
  ];
  for (const [pageName, sectionId] of categories) {
    assert.match(read(pageName), new RegExp(`<media-gallery section-id="${sectionId}"`));
    const config = JSON.parse(read(pageName, 'json'));
    assert.equal(config.usingComponents['media-gallery'], '/components/media-gallery/index');
  }
});

test('experience renders five causal craft tasks and all adjustment controls', () => {
  const markup = read('experience');
  for (const text of ['做捻子', '装家生', '打箔', '出具检查', '切箔成叶', '返回定点补锤', '旋转箔包', '新手护航']) assert.match(markup, new RegExp(text));
  for (const handler of ['onCutMove', 'onPlaceMove', 'previewHammerCell', 'cancelHammerPress', 'hammerCell', 'probeInspectionCell', 'returnToHammer', 'onSmoothMove', 'assistCurrentStep']) assert.equal(typeof load('experience')[handler], 'function');
  assert.match(markup, /<video-player/);
  assert.match(markup, /activeKnowledgeCard.notice/);
});

test('normal experience persists a report and progress can open its detail page', () => {
  const experienceSource = read('experience', 'js');
  const progress = load('progress');
  assert.match(experienceSource, /createLearningSession/);
  assert.match(experienceSource, /learningSession: this\.learningSession/);
  assert.match(experienceSource, /whenLearningSettled\(\)/);
  assert.match(experienceSource, /reportId=\$\{encodeURIComponent\(report\.reportId\)\}/);
  assert.equal(typeof progress.openReport, 'function');
  assert.match(read('progress'), /data-report-id="\{\{item\.reportId\}\}"/);

  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    progress.openReport({ currentTarget: { dataset: { routeId: 'foil_making_candidate', reportId: 'local_001' } } });
    assert.deepEqual(calls, ['/pages/result/index?routeId=foil_making_candidate&reportId=local_001']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('progress shows a readable route name in session log and an empty-collection message when there are no favorites', async () => {
  const progress = load('progress');
  const markup = read('progress');
  assert.doesNotMatch(markup, /class="report-route">\{\{item\.routeId\}\}/);
  assert.match(markup, /class="report-route">\{\{item\.routeDisplayName\}\}/);
  assert.match(markup, /wx:else class="empty-state">还没有收藏内容。<\/view>/);

  const previousWx = global.wx;
  const snapshot = {
    version: 1,
    sessions: [{ reportId: 'local_1', sessionId: 'local_1', routeId: 'foil_making_candidate', startedAt: 0, status: 'completed', completedAt: 100, elapsedMs: 100, steps: [] }],
    favorites: [],
  };
  global.wx = {
    getStorage: ({ success }) => success({ data: snapshot }),
    setStorage: ({ complete }) => complete(),
  };
  const context = { data: { reports: [], favorites: [], navTopPadding: 68 }, setData(patch) { Object.assign(this.data, patch); } };
  try {
    await progress.onShow.call(context);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
  assert.equal(context.data.reports[0].routeDisplayName, '金箔锻制体验');
  assert.equal(context.data.favorites.length, 0);
});

test('archive presents one spacious route exhibit while retaining learning actions and every knowledge card', () => {
  const markup = read('archive');
  const styles = read('archive', 'wxss');
  const page = load('archive');
  for (const token of ['route-exhibit', 'route-hero', 'knowledge-section', 'knowledge-list']) {
    assert.match(markup, new RegExp(token.replace(/[.[\]]/g, '\\$&')));
  }
  for (const handler of ['startExperience', 'toggleFavorite']) assert.equal(typeof page[handler], 'function');
  for (const handler of ['openProgress', 'goHome']) assert.equal(typeof page[handler], 'undefined');
  assert.match(markup, /data-route-id="\{\{item\.id\}\}" bindtap="startExperience"/);
  assert.match(markup, /data-route-id="\{\{item\.id\}\}" bindtap="toggleFavorite"/);
  assert.match(styles, /grid-template-columns: 178rpx minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(max-width: 360px\)/);
  assert.equal(JSON.parse(read('archive', 'json')).navigationStyle, 'custom');
});

test('archive renders the same route fields whether the repository call succeeds or fails', () => {
  load('archive');
  const { createRouteSummary } = require(path.join(root, 'miniprogram/pages/archive/index.js'));
  const [route] = require(path.join(root, 'miniprogram/data/routes.js'));
  const fallback = createRouteSummary(route);
  const populated = createRouteSummary(route, {
    favorite: true,
    progress: { routeId: route.id, completedCount: 2, lastCompletedAt: 10, lastElapsedMs: 20 },
  });

  for (const field of ['id', 'displayName', 'visual', 'cards']) {
    assert.deepEqual(populated[field], fallback[field]);
  }
  assert.equal(fallback.favorite, false);
  assert.deepEqual(fallback.progress, { completedCount: 0 });
  assert.equal(populated.favorite, true);
  assert.equal(populated.progress.completedCount, 2);

  const source = read('archive', 'js');
  assert.match(source, /publicRoutes\.map\(async \(route\) => createRouteSummary\(route/);
  assert.match(source, /publicRoutes\.map\(\(route\) => createRouteSummary\(route\)\)/);
});

test('static exhibit pages use one bottom return action instead of a top navigation row', () => {
  for (const page of ['progress']) {
    assert.equal(JSON.parse(read(page, 'json')).navigationStyle, 'custom');
    assert.match(read(page), /class="(?:archive|progress)-footer"[\s\S]*bindtap="goHome"/);
    assert.doesNotMatch(read(page), /(?:archive|progress)-topbar|class="back-button"/);
    assert.equal(typeof load(page).applyNavRightPadding, 'undefined');
  }
});

test('activity, media and archive rely on the persistent tab bar instead of their own return button', () => {
  for (const page of ['activity', 'media', 'archive']) {
    assert.equal(JSON.parse(read(page, 'json')).navigationStyle, 'custom');
    assert.doesNotMatch(read(page), /(?:activity|media|archive)-footer|footer-link|bindtap="goHome"|class="back-button"|topbar/);
    assert.equal(typeof load(page).goHome, 'undefined');
  }
});

test('dark exhibit shells use canonical tokens and a non-repeating navigation bar', () => {
  const appStyles = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  assert.match(appStyles, /--exhibit-bg-radial:/);
  assert.match(appStyles, /--exhibit-gold: #f4d77b;/);
  assert.doesNotMatch(appStyles, /--gold-bright/);

  for (const page of ['home', 'media', 'archive', 'activity', 'progress', 'result']) {
    const styles = read(page, 'wxss');
    assert.match(styles, /var\(--exhibit-bg-radial\)/);
    assert.match(styles, /var\(--exhibit-gold\)/);
  }
  for (const page of ['progress']) {
    const markup = read(page);
    const styles = read(page, 'wxss');
    assert.match(markup, /class="(?:archive|progress)-footer"[\s\S]*bindtap="goHome"/);
    assert.doesNotMatch(markup, /topbar|back-button|navRightPadding/);
    assert.match(styles, /\.footer-link \{[^}]*color: var\(--exhibit-gold\)/);
  }
  for (const page of ['activity', 'archive']) {
    assert.doesNotMatch(read(page), /(?:activity|archive)-footer|footer-link|topbar|back-button|navRightPadding/);
  }
  const mediaMarkup = read('media');
  const mediaStyles = read('media', 'wxss');
  const mediaSource = read('media', 'js');
  assert.doesNotMatch(mediaMarkup, /media-footer|footer-link|media-topbar|back-button|navRightPadding/);
  assert.doesNotMatch(mediaSource, /getNavRightPadding|navRightPadding/);
  assert.match(mediaStyles, /\.media-page \{[^}]*margin: -32rpx/);
  const galleryMarkup = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.wxml'), 'utf8');
  const galleryStyles = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.wxss'), 'utf8');
  const gallerySource = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.js'), 'utf8');
  assert.match(galleryMarkup, /class="gallery-footer"[\s\S]*bindtap="goBack">返回影像记录<\/button>/);
  assert.doesNotMatch(galleryMarkup, /category-topbar|back-button|navRightPadding/);
  assert.doesNotMatch(gallerySource, /getNavRightPadding|navRightPadding/);
  assert.match(galleryStyles, /\.category-page \{[^}]*margin: -32rpx/);
  assert.match(galleryStyles, /background: var\(--exhibit-bg-radial\)/);
});

test('short pages grow their content to fill the screen instead of leaving a dead gap', () => {
  for (const page of ['progress']) {
    const styles = read(page, 'wxss');
    assert.match(styles, new RegExp(`\\.${page}-page \\{[^}]*flex-direction: column`));
    assert.match(styles, new RegExp(`\\.${page}-footer \\{[^}]*margin-top: auto`));
  }

  const activityStyles = read('activity', 'wxss');
  assert.match(activityStyles, /\.activity-page \{[^}]*flex-direction: column/);
  assert.match(activityStyles, /\.activity-intro \{[^}]*flex: 1/);
  assert.doesNotMatch(activityStyles, /\.activity-intro \{[^}]*justify-content: space-between/);
  assert.match(activityStyles, /padding: 0 30rpx calc\(56rpx \+ env\(safe-area-inset-bottom\)\)/);

  // media/index tried both an unbounded auto-fill (grows with device height, no cap) and an
  // unbounded gap-before-footer; both looked disproportionate on taller screens. It now uses
  // fixed, bounded spacing throughout, matching the page's normal rhythm: cards keep their
  // natural height, the gap between them stays a normal fixed value, and any true leftover
  // space (on a screen taller than the content) settles below the footer button instead of
  // stretching something into an oversized gap.
  const mediaMarkup = read('media');
  const mediaStyles = read('media', 'wxss');
  assert.match(mediaMarkup, /<view class="category-list">/);
  assert.doesNotMatch(mediaStyles, /\.media-content \{[^}]*flex: 1/);
  assert.doesNotMatch(mediaStyles, /\.category-list \{[^}]*flex: 1/);
  assert.match(mediaStyles, /\.category-list \{[^}]*gap: 18rpx/);
  assert.doesNotMatch(mediaStyles, /\.category-list \{[^}]*justify-content: space-between/);
  assert.doesNotMatch(mediaStyles, /\.category-card \{[^}]*flex: 1/);
  assert.match(mediaStyles, /\.category-footer \{[^}]*margin-top: 21rpx/);

  const galleryStyles = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.wxss'), 'utf8');
  assert.match(galleryStyles, /\.category-page \{[^}]*flex-direction: column/);
  assert.match(galleryStyles, /\.gallery-footer \{[^}]*margin-top: auto/);
  assert.match(galleryStyles, /\.video-content \{[^}]*flex: 1/);
  assert.match(galleryStyles, /\.video-card \{[^}]*flex: 1/);
  assert.match(galleryStyles, /\.video-cover \{[^}]*flex: 1/);
  // A growing cover must keep the poster filling it, so the image is pinned to all four edges.
  assert.match(galleryStyles, /\.video-cover image \{[^}]*position: absolute/);

  const homeStyles = read('home', 'wxss');
  assert.match(homeStyles, /\.home-page \{[^}]*flex-direction: column/);
  assert.match(homeStyles, /\.home-content \{[^}]*flex: 1/);
  assert.match(homeStyles, /\.home-hero \{[^}]*flex-shrink: 0/);
});

test('custom-navigation pages clear the capsule using its real position, not env(safe-area-inset-top)', () => {
  // env(safe-area-inset-top) reports 0 on notchless devices and the simulator, and even its 44px
  // notched-device value still lands above the capsule's bottom edge — either way content collides
  // with the capsule. getNavTopPadding() measures the capsule directly instead.
  for (const page of ['home', 'media', 'activity', 'archive', 'progress', 'result', 'experience']) {
    const source = read(page, 'js');
    const styles = read(page, 'wxss');
    assert.match(source, /getNavTopPadding/);
    assert.doesNotMatch(styles, /env\(safe-area-inset-top\)/);
    assert.match(read(page), /navTopPadding/);
  }

  const gallerySource = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.js'), 'utf8');
  const galleryMarkup = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.wxml'), 'utf8');
  const galleryStyles = fs.readFileSync(path.join(root, 'miniprogram/components/media-gallery/index.wxss'), 'utf8');
  assert.match(gallerySource, /getNavTopPadding/);
  assert.match(galleryMarkup, /navTopPadding/);
  assert.doesNotMatch(galleryStyles, /env\(safe-area-inset-top\)/);
});

test('experience visual system exposes grid states, risk, scan, and final trace', () => {
  const styles = read('experience', 'wxss');
  assert.match(styles, /\.experience-shell \{[^}]*background: var\(--exhibit-bg-radial\)/);
  assert.match(styles, /\.eyebrow \{[^}]*color: var\(--exhibit-gold\)/);
  assert.match(styles, /\.gold-button \{[^}]*background: var\(--exhibit-gold-button\)/);
  for (const token of ['cell.risk', 'inspection-surface', 'scan-light', 'final-foil', 'app-progress', 'moment-toast', 'combo-badge', 'celebration-particles', '@media (max-width: 360px)', '@media (min-width: 900px)']) {
    assert.match(styles, new RegExp(token.replace(/[().]/g, '\\$&')));
  }
});

test('experience uses non-blocking game feedback instead of a hammer overlay', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  assert.doesNotMatch(markup, /rhythm-mask/);
  for (const token of ['rhythm-coach', 'nextHammerHintId', 'inspectDiscoveryCount', 'finish-percent']) assert.match(markup, new RegExp(token));
  assert.match(source, /if \(this\.data\.isRotating\) return/);
  assert.doesNotMatch(source, /rhythmIntroActive \|\| this\.data\.isRotating/);
  assert.match(source, /getMenuButtonBoundingClientRect/);
  assert.equal(JSON.parse(read('experience', 'json')).navigationStyle, 'custom');
});

test('beginner hammering previews and blocks dangerous thin-area hits before mutating the foil', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  assert.match(markup, /bindtouchstart="previewHammerCell"/);
  assert.match(markup, /hammerWarningCellId/);
  assert.match(source, /this\.data\.beginnerMode && before && before\.value <= 42/);
  assert.match(source, /危险落点已拦截 · 金箔没有受损/);
});

test('hammering exposes a visible beat, press charge, local impact score, and no extra completion gate', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  for (const token of ['hammer-challenge', 'rhythm-cursor', 'hammerCharge', 'hammerScore', 'hammerGradeLabel', 'impact-sparks', 'hammer-input-readout', 'hammerPowerLabel', 'hammerRhythmLabel']) {
    assert.match(markup, new RegExp(token));
  }
  assert.match(source, /evaluateHammerGesture/);
  assert.match(source, /pressDurationMs/);
  assert.match(source, /intervalMs/);
  assert.match(source, /HAMMER_BEAT_MS = 900/);
  assert.match(source, /beatPhase/);
  assert.match(source, /scoreGain/);
  assert.match(source, /hammerChargeTimer/);
  assert.match(source, /balancedHit/);
});

test('cutting only assists near the target and exposes a locked three-piece state', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  assert.match(markup, /cut-full-state/);
  assert.match(markup, /session\.sheetCount >= 3/);
  assert.match(source, /rawRatio >= \.72 && rawRatio <= 1\.28/);
  assert.match(source, /明显过小，没有计入/);
});

test('all five craft tasks expose a clear locked or ready state', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  for (const token of ['cut-full-state', 'pack-full-state', 'hammer-ready-state', '探查完成', 'finishProgress >= 100']) assert.match(markup, new RegExp(token));
  assert.match(source, /placements\.length >= 3/);
  assert.match(source, /if \(!this\.data\.finishReady \|\| this\.data\.isCelebrating\) return/);
});

test('cutting, packing, and finishing expose distinct gesture gates with beginner-safe assistance', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  for (const token of ['cutStability', 'placementSettling', 'placementReady', 'finishHolding', 'finishReady']) {
    assert.match(markup, new RegExp(token));
  }
  for (const token of ['evaluateCutGesture', 'resolvePlacementDrop', 'evaluateFinishHold']) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /placement\.assistedSettle/);
  assert.match(source, /resolvePlacementDrop\(\{\s*x: rawX,\s*y: rawY/);
  assert.match(source, /rawOffset <= PLACEMENT_TARGET_THRESHOLD/);
  assert.match(markup, /placementRejected/);
  assert.match(source, /beginFinishHold/);
});

test('deep craft scenes expose real tool metaphors and local material response in all five tasks', () => {
  const markup = read('experience');
  const styles = read('experience', 'wxss');
  for (const token of ['material-memory', 'piece-tray', 'cutter-blade', 'tweezer-tool', 'hammer-tool', 'inspection-lamp', 'finish-trail', 'finished-leaf-seal']) {
    assert.match(markup, new RegExp(token));
  }
  for (const token of ['gold-grain', 'paper-fibre', 'hammer-head', 'dwell-ring', 'cell-wrinkle', 'feather-vane']) {
    assert.match(styles, new RegExp(token));
  }
});

test('cutting and packing feedback stays layout-stable without large-area shake animation', () => {
  const styles = read('experience', 'wxss');
  assert.match(styles, /\.feedback \{[^}]*height: 76rpx/);
  assert.match(styles, /\.cut-full-state \{[^}]*animation: calm-reveal/);
  assert.match(styles, /\.pack-full-state \{[^}]*animation: calm-reveal/);
  assert.match(styles, /\.paper-pack\.is-placement-ready \.placement-target \{[^}]*animation: none/);
});

test('inspection uses a moving light and local dwell reveal before unlocking a single decision', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  assert.match(markup, /bindtouchstart="onInspectStart"/);
  assert.match(markup, /catchtouchmove="onInspectMove"/);
  assert.match(markup, /inspectDwell/);
  assert.doesNotMatch(markup, /bindtap="probeInspectionCell"/);
  assert.match(markup, /inspectDiscoveryCount \+ ' \/ 3'/);
  assert.match(markup, /session\.inspectionSweeps < 1 \|\| !repairSuggested/);
  assert.match(source, /Math\.min\(3, this\.data\.inspectDiscoveryCount \+ 1\)/);
  assert.match(source, /if \(inspectDiscoveryCount >= 3\) this\.controller\.sweepInspection\(\)/);
  assert.match(source, /beginInspectionCandidate/);
  assert.match(source, /requiredMs = this\.data\.beginnerMode \? 260 : 420/);
});

test('experience initializes anonymous analytics and short action videos', () => {
  const source = read('experience', 'js');
  assert.match(source, /createTrialAnalytics/);
  assert.match(source, /getStepVideo/);
  assert.match(source, /networkType/);
});

test('ninety-second demo starts at hammer, skips media, and keeps its timer and result isolated', () => {
  const markup = read('experience');
  const source = read('experience', 'js');
  assert.match(markup, /开始 90 秒演示/);
  assert.match(markup, /demoSecondsLeft/);
  assert.match(source, /options\.mode === 'demo'/);
  assert.match(source, /this\.controller\.startDemo\(\)/);
  assert.match(source, /this\.data\.demoMode \? true/);
  assert.match(source, /latest_foil_demo_result/);
  assert.match(source, /&mode=demo/);
});

test('result shows grid-derived quality and sharing actions', () => {
  const markup = read('result');
  for (const text of ['foilResult.metrics.coverage', 'foilQualityLabel', '生成我的体验海报', '保存到相册', '再体验一次']) assert.match(markup, new RegExp(text.replace('.', '\\.')));
  assert.match(read('result', 'js'), /latest_foil_result/);
  assert.match(read('result', 'js'), /latest_foil_demo_result/);
});

test('result keeps progress visible in demo mode but explains why it is unavailable', () => {
  const markup = read('result');
  const styles = read('result', 'wxss');
  const page = load('result');
  assert.doesNotMatch(markup, /wx:if="\{\{!demoMode\}\}"[^>]*openProgress/);
  assert.match(markup, /class="\{\{demoMode \? 'is-disabled' : ''\}\}" aria-disabled="\{\{demoMode\}\}" bindtap="openProgress">查看我的进度<\/button>/);
  assert.match(styles, /\.action-grid button\.is-disabled \{[^}]*color: var\(--exhibit-text-soft-42\)/);

  const calls = [];
  const previousWx = global.wx;
  global.wx = {
    navigateTo: ({ url }) => calls.push(['navigate', url]),
    showToast: (options) => calls.push(['toast', options]),
  };
  try {
    page.openProgress.call({ data: { demoMode: true }, trackAction: () => calls.push(['track']) });
    assert.deepEqual(calls, [['toast', { title: '完整体验后可查看', icon: 'none' }]]);

    calls.length = 0;
    page.openProgress.call({ data: { demoMode: false }, trackAction: (action) => calls.push(['track', action]) });
    assert.deepEqual(calls, [
      ['track', 'archive'],
      ['navigate', '/pages/progress/index'],
    ]);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('result uses immersive navigation and relies on its footer actions instead of a top close button', () => {
  assert.equal(JSON.parse(read('result', 'json')).navigationStyle, 'custom');
  assert.doesNotMatch(read('result'), /class="close"|closeResult/);
  const page = load('result');
  assert.equal(typeof page.closeResult, 'undefined');
  assert.equal(typeof page.applyNavRightPadding, 'undefined');

  const calls = [];
  const previousWx = global.wx;
  global.wx = { switchTab: ({ url }) => calls.push(url) };
  try {
    page.goHome();
    assert.deepEqual(calls, ['/pages/home/index']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('all registered page modules and artifacts compile', () => {
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')).pages;
  for (const pagePath of pages) {
    const page = pagePath.split('/')[1];
    for (const extension of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, 'miniprogram/pages', page, `index.${extension}`)));
    assert.doesNotThrow(() => load(page));
  }
});

test('result poster and restart preserve normal or isolated demo totals', () => {
  const source = read('result', 'js');
  assert.match(source, /this\.data\.demoMode \? 3 : 5/);
  assert.match(source, /this\.data\.demoMode \? '&mode=demo' : ''/);
  assert.match(read('result'), /演示预置状态/);
});
