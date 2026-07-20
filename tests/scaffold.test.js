const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeConfigPath = path.join(root, 'miniprogram/config/runtime-config.js');
const appScriptPath = path.join(root, 'miniprogram/app.js');

function createRuntimeConfig(overrides = {}) {
  return Object.freeze({
    appVersion: '0.1.0-trial',
    displayEnvironment: 'trial',
    cloudEnvId: null,
    eventSource: 'internal_trial',
    testAccountTag: null,
    ...overrides,
  });
}

function loadRegisteredApp({ runtimeConfig, wx }) {
  const runtimeModulePath = require.resolve(runtimeConfigPath);
  const appModulePath = require.resolve(appScriptPath);
  const previousRuntimeModule = require.cache[runtimeModulePath];
  const previousAppModule = require.cache[appModulePath];
  const previousApp = global.App;
  const hadWx = Object.hasOwn(global, 'wx');
  const previousWx = global.wx;
  let appDefinition;

  global.App = (definition) => {
    appDefinition = definition;
  };
  if (wx === undefined) delete global.wx;
  else global.wx = wx;
  require.cache[runtimeModulePath] = { exports: { ...runtimeConfig } };
  delete require.cache[appModulePath];
  require(appModulePath);

  return {
    appDefinition,
    restore() {
      delete require.cache[appModulePath];
      if (previousAppModule) require.cache[appModulePath] = previousAppModule;
      if (previousRuntimeModule) require.cache[runtimeModulePath] = previousRuntimeModule;
      else delete require.cache[runtimeModulePath];
      if (previousApp === undefined) delete global.App;
      else global.App = previousApp;
      if (hadWx) global.wx = previousWx;
      else delete global.wx;
    },
  };
}

test('registers the five P0 pages and cloud roots', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json'), 'utf8'));
  assert.deepEqual(app.pages, [
    'pages/home/index',
    'pages/experience/index',
    'pages/result/index',
    'pages/archive/index',
    'pages/activity/index',
  ]);
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  assert.equal(project.cloudfunctionRoot, 'cloudfunctions/');
});

test('provides compilable files for every registered page', () => {
  const { pages } = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

  for (const pagePath of pages) {
    const pageRoot = path.join(root, 'miniprogram', pagePath);
    for (const extension of ['.js', '.json', '.wxml', '.wxss']) {
      assert.ok(fs.existsSync(`${pageRoot}${extension}`), `${pagePath}${extension} should exist`);
    }
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(`${pageRoot}.json`, 'utf8')));

    const pageModulePath = require.resolve(`${pageRoot}.js`);
    const previousPage = global.Page;
    let pageDefinition;
    global.Page = (definition) => {
      pageDefinition = definition;
    };
    try {
      delete require.cache[pageModulePath];
      require(pageModulePath);
      assert.ok(pageDefinition && typeof pageDefinition === 'object', `${pagePath}.js should register Page`);
    } finally {
      delete require.cache[pageModulePath];
      if (previousPage === undefined) delete global.Page;
      else global.Page = previousPage;
    }
  }
});

test('labels home and experience screens as unconfirmed candidate illustrations', () => {
  const requiredNotice = '候选示意，尚未经专业确认';
  for (const page of ['home', 'experience']) {
    const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages', page, 'index.wxml'), 'utf8');
    assert.ok(wxml.includes(requiredNotice), `${page} page should display the candidate notice`);
  }
});

test('exports the exact frozen trial runtime configuration', () => {
  const runtimeConfig = require(runtimeConfigPath);
  assert.deepEqual(runtimeConfig, {
    appVersion: '0.1.0-trial',
    displayEnvironment: 'trial',
    cloudEnvId: null,
    eventSource: 'internal_trial',
    testAccountTag: null,
  });
  assert.ok(Object.isFrozen(runtimeConfig));
});

test('reports the CloudBase compatibility error when wx.cloud is unavailable', () => {
  const loaded = loadRegisteredApp({ runtimeConfig: createRuntimeConfig(), wx: undefined });
  try {
    assert.throws(() => loaded.appDefinition.onLaunch(), /当前微信基础库不支持云开发/);
  } finally {
    loaded.restore();
  }
});

test('initializes CloudBase without an environment when cloudEnvId is null', () => {
  let initOptions;
  const loaded = loadRegisteredApp({
    runtimeConfig: createRuntimeConfig(),
    wx: { cloud: { init: (options) => { initOptions = options; } } },
  });
  try {
    loaded.appDefinition.onLaunch();
    assert.deepEqual(initOptions, { traceUser: true });
  } finally {
    loaded.restore();
  }
});

test('initializes CloudBase with cloudEnvId when it is configured', () => {
  let initOptions;
  const loaded = loadRegisteredApp({
    runtimeConfig: createRuntimeConfig({ cloudEnvId: 'trial-cloud' }),
    wx: { cloud: { init: (options) => { initOptions = options; } } },
  });
  try {
    loaded.appDefinition.onLaunch();
    assert.deepEqual(initOptions, { traceUser: true, env: 'trial-cloud' });
  } finally {
    loaded.restore();
  }
});
