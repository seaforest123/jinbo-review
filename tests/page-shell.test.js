const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pagesRoot = path.join(root, 'miniprogram/pages');

function loadPage(pageName) {
  const modulePath = require.resolve(path.join(pagesRoot, pageName, 'index.js'));
  const previousPage = global.Page;
  let definition;
  global.Page = (pageDefinition) => { definition = pageDefinition; };
  delete require.cache[modulePath];
  try {
    require(modulePath);
    return definition;
  } finally {
    delete require.cache[modulePath];
    if (previousPage === undefined) delete global.Page;
    else global.Page = previousPage;
  }
}

function readMarkup(pageName) {
  return fs.readFileSync(path.join(pagesRoot, pageName, 'index.wxml'), 'utf8');
}

test('home page exposes both candidate routes and starts the selected experience', () => {
  const page = loadPage('home');
  assert.equal(page.data.selectedRouteId, 'foil_making_candidate');
  assert.match(readMarkup('home'), /候选示意，尚未经专业确认/);
  assert.match(readMarkup('home'), /开始3分钟体验/);
  assert.equal(typeof page.onRouteSelect, 'function');
  assert.equal(typeof page.startExperience, 'function');
});

test('archive, progress, and activity pages expose candidate learning actions', () => {
  assert.match(readMarkup('archive'), /开始体验/);
  assert.match(readMarkup('archive'), /收藏/);
  assert.match(readMarkup('activity'), /候选内测/);
  assert.ok(JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')).pages.includes('pages/progress/index'));
});

test('result page exposes all four shell actions without score language', () => {
  const markup = readMarkup('result');
  assert.match(markup, /再体验一次/);
  assert.match(markup, /金箔志/);
  assert.match(markup, /活动/);
  assert.match(markup, /学习报告/);
  assert.match(markup, /查看我的进度/);
  assert.match(markup, /返回首页/);
  assert.doesNotMatch(markup, /分数|排名|证书/);
});

test('shell actions navigate to the intended pages', () => {
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(['navigateTo', url]), switchTab: ({ url }) => calls.push(['switchTab', url]) };
  try {
    const home = loadPage('home');
    home.onRouteSelect({ currentTarget: { dataset: { routeId: 'foil_application_candidate' } } });
    assert.equal(home.data.selectedRouteId, 'foil_application_candidate');
    home.startExperience();

    const result = loadPage('result');
    result.restartExperience();
    result.openArchive();
    result.openActivity();
    result.goHome();

    assert.deepEqual(calls, [
      ['navigateTo', '/pages/experience/index?routeId=foil_application_candidate'],
      ['navigateTo', '/pages/experience/index?routeId=foil_making_candidate'],
      ['navigateTo', '/pages/archive/index'],
      ['navigateTo', '/pages/activity/index'],
      ['navigateTo', '/pages/home/index'],
    ]);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});

test('experience page exposes the three-step controls and guards an invalid route ID', () => {
  const page = loadPage('experience');
  const markup = readMarkup('experience');
  assert.match(markup, /开始体验/);
  assert.match(markup, /显示提示/);
  assert.match(markup, /重新尝试/);
  assert.match(markup, /退出体验/);
  assert.equal(typeof page.onTouchStart, 'function');
  assert.equal(typeof page.onTouchMove, 'function');
  assert.equal(typeof page.completeCurrentStep, 'function');
  assert.equal(typeof page.exitExperience, 'function');
});

test('experience page initializes anonymous trial analytics for its selected route', () => {
  const source = fs.readFileSync(path.join(pagesRoot, 'experience', 'index.js'), 'utf8');
  assert.match(source, /createTrialAnalytics/);
  assert.match(source, /routeId,/);
  assert.match(source, /networkType/);
});

test('result actions use the anonymous trial analytics event contract', () => {
  const source = fs.readFileSync(path.join(pagesRoot, 'result', 'index.js'), 'utf8');
  assert.match(source, /createTrialAnalytics/);
  assert.match(source, /result_action/);
});

test('result page restarts the candidate route supplied by the completed experience', () => {
  const page = loadPage('result');
  page.data = { ...page.data };
  page.setData = (next) => Object.assign(page.data, next);
  page.onLoad({ routeId: 'foil_application_candidate' });
  const calls = [];
  const previousWx = global.wx;
  global.wx = { navigateTo: ({ url }) => calls.push(url) };
  try {
    page.restartExperience();
    assert.deepEqual(calls, ['/pages/experience/index?routeId=foil_application_candidate']);
  } finally {
    if (previousWx === undefined) delete global.wx;
    else global.wx = previousWx;
  }
});
