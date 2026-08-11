'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const componentRoot = path.join(root, 'miniprogram/components/video-player');

function loadComponent() {
  const target = require.resolve(path.join(componentRoot, 'index.js'));
  const previous = global.Component;
  let definition;
  global.Component = (value) => { definition = value; };
  delete require.cache[target];
  require(target);
  if (previous === undefined) delete global.Component; else global.Component = previous;
  return definition;
}

test('provides one reusable native video player component', () => {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(componentRoot, `index.${extension}`)));
  }
  const definition = loadComponent();
  assert.equal(definition.properties.showCenterPlayBtn.value, true);
  assert.equal(typeof definition.methods.handleEnded, 'function');
  assert.match(fs.readFileSync(path.join(componentRoot, 'index.wxml'), 'utf8'), /<video/);
});

test('forwards native video lifecycle events to host pages', () => {
  const definition = loadComponent();
  const received = [];
  const instance = { triggerEvent: (name, detail) => received.push({ name, detail }) };
  definition.methods.handleEnded.call(instance, { detail: { currentTime: 12 } });
  definition.methods.handleError.call(instance, { detail: { errMsg: 'video error' } });
  assert.deepEqual(received, [
    { name: 'ended', detail: { currentTime: 12 } },
    { name: 'error', detail: { errMsg: 'video error' } },
  ]);
});
