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
  assert.equal(typeof page.startExperience, 'function');
  assert.match(read('home'), /五道工序/);
  assert.match(read('home'), /process-rail/);
  assert.match(read('home'), /五道工序，一次完成/);
  assert.match(read('home'), /实际合作对象与城市待专业访谈确认/);
  assert.equal(JSON.parse(read('home', 'json')).navigationStyle, 'custom');
  assert.match(read('home'), /PROCESS LAB/);
});

test('craft flow renders all twelve steps and leads to the foil application', () => {
  const markup = read('craft');
  for (const text of ['十二道手', '读完工艺', '开始体验', '实际合作对象与城市待专业访谈确认']) assert.match(markup, new RegExp(text));
  assert.equal(typeof load('craft').startFoilApplication, 'function');
});

test('foil application exposes slow placement, fast failure, and a result action', () => {
  const markup = read('foil-apply');
  for (const handler of ['onFoilStart', 'onFoilMove', 'onFoilEnd', 'restartApplication', 'openResult']) assert.equal(typeof load('foil-apply')[handler], 'function');
  assert.match(markup, /慢一点/);
  assert.match(markup, /生成我的成品/);
  assert.match(read('foil-result'), /用箔/);
});

test('the public main flow links home to the five-step experience', () => {
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    load('home').startExperience();
    assert.deepEqual(calls, ['/pages/experience/index?routeId=foil_making_candidate']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('home links to the image and video record centre', () => {
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    const page = load('home');
    assert.equal(typeof page.openMedia, 'function');
    page.openMedia();
    assert.deepEqual(calls, ['/pages/media/index']);
    assert.match(read('home'), /影像记录/);
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
  for (const handler of ['openCategory', 'goHome']) assert.equal(typeof page[handler], 'function');
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

test('experience visual system exposes grid states, risk, scan, and final trace', () => {
  const styles = read('experience', 'wxss');
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
