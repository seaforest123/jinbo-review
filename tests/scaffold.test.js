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

test('registers the public five-step experience pages and cloud roots', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.example.json'), 'utf8'));
  assert.deepEqual(app.pages, [
    'pages/home/index',
    'pages/experience/index',
    'pages/result/index',
    'pages/archive/index',
    'pages/activity/index',
    'pages/progress/index',
    'pages/media/index',
    'pages/media/interviews/index',
    'pages/media/process/index',
    'pages/media/extended/index',
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

test('labels the public home screen as unconfirmed candidate content', () => {
  const home = fs.readFileSync(path.join(root, 'miniprogram/pages/home/index.wxml'), 'utf8');
  assert.match(home, /实际合作对象与城市待专业访谈确认/);
  assert.doesNotMatch(home, /南京/);
});

test('keeps 南京 only in explicit technical-reference copy', () => {
  const files = [
    'miniprogram/data/craft-steps.js',
    'miniprogram/data/knowledge-cards.js',
  ];
  const matches = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && /\.(js|wxml)$/.test(entry.name) && fs.readFileSync(target, 'utf8').includes('南京')) {
        matches.push(path.relative(root, target).replace(/\\/g, '/'));
      }
    }
  }
  walk(path.join(root, 'miniprogram'));
  assert.deepEqual(matches.sort(), files.sort());
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

test('keeps the optional local CloudBase override out of version control', () => {
  const ignored = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(ignored, /^miniprogram\/config\/runtime-config\.local\.js$/m);
  assert.equal(require(runtimeConfigPath).cloudEnvId, null);
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
    wx: { cloud: { init: (options) => { initOptions = options; }, database: () => ({}) } },
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
    wx: { cloud: { init: (options) => { initOptions = options; }, database: () => ({}) } },
  });
  try {
    loaded.appDefinition.onLaunch();
    assert.deepEqual(initOptions, { traceUser: true, env: 'trial-cloud' });
  } finally {
    loaded.restore();
  }
});

test('creates and stores a CloudBase-backed content repository during launch', () => {
  let databaseCalls = 0;
  const database = {};
  const loaded = loadRegisteredApp({
    runtimeConfig: createRuntimeConfig(),
    wx: {
      cloud: {
        init: () => {},
        database: () => {
          databaseCalls += 1;
          return database;
        },
      },
    },
  });

  try {
    loaded.appDefinition.onLaunch();
    assert.equal(databaseCalls, 1);
    assert.equal(typeof loaded.appDefinition.globalData.contentRepository.loadRoutes, 'function');
  } finally {
    loaded.restore();
  }
});
